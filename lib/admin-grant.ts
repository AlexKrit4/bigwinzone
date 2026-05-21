import { PromoWagerStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { calcWagerRequired, cancelPromoActivation } from "@/lib/promo";
import { ADMIN_GRANT_CODE_PREFIX } from "@/lib/promo-codes";
import { creditUserBalance, debitUserBalance } from "@/lib/wallet";

type Tx = Prisma.TransactionClient;

export { isAdminGrantCode } from "@/lib/promo-codes";

function randomAdminCode() {
  const tail = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `${ADMIN_GRANT_CODE_PREFIX}${tail}`.slice(0, 24);
}

export async function findActiveAdminGrants(tx: Tx, userId: string) {
  return tx.promoActivation.findMany({
    where: {
      userId,
      status: PromoWagerStatus.WAGERING,
      promoCode: { code: { startsWith: ADMIN_GRANT_CODE_PREFIX } },
    },
    include: { promoCode: true },
    orderBy: { appliedAt: "desc" },
  });
}

/** Выдать баланс с отыгрышем; пользователь видит код ADM-… как промо. */
export async function createAdminGrant(
  tx: Tx,
  userId: string,
  amount: number,
  wagerMultiplier: number,
  note: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
  if (!Number.isFinite(wagerMultiplier) || wagerMultiplier < 0) {
    throw new Error("INVALID_WAGER");
  }

  const existing = await findActiveAdminGrants(tx, userId);
  if (existing.length > 0) {
    throw new Error("ADMIN_GRANT_ACTIVE");
  }

  const code = randomAdminCode();
  const wagerRequired =
    wagerMultiplier > 0 ? calcWagerRequired(amount, 0, wagerMultiplier) : 0;
  const needsWager = wagerRequired > 0;

  const promo = await tx.promoCode.create({
    data: {
      code,
      depositBonusPercent: 0,
      wagerMultiplier,
      maxUses: 1,
      usedCount: 1,
      active: false,
    },
  });

  await creditUserBalance(tx, userId, amount, "ADMIN_GRANT", promo.id, note);

  const activation = await tx.promoActivation.create({
    data: {
      userId,
      promoCodeId: promo.id,
      status: needsWager ? PromoWagerStatus.WAGERING : PromoWagerStatus.COMPLETED,
      bonusAmount: amount,
      depositAmount: 0,
      wagerRequired,
      wagerProgress: 0,
      appliedAt: new Date(),
      completedAt: needsWager ? null : new Date(),
    },
    include: { promoCode: true },
  });

  const balance = Number(
    (await tx.user.findUnique({ where: { id: userId }, select: { balance: true } }))
      ?.balance ?? 0,
  );

  return { activation, promo, balance, code };
}

/** Списать сумму с баланса; по умолчанию отменяет активные ADM-бонусы. */
export async function adminRevokeBalance(
  tx: Tx,
  userId: string,
  amount: number,
  note: string,
  options?: { cancelAdminGrants?: boolean },
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");

  if (options?.cancelAdminGrants !== false) {
    const grants = await findActiveAdminGrants(tx, userId);
    for (const g of grants) {
      await cancelPromoActivation(tx, userId, g.id);
    }
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  const balance = Number(user.balance);
  const take = Math.min(amount, balance);
  if (take <= 0) throw new Error("NOTHING_TO_REVOKE");

  await debitUserBalance(tx, userId, take, "ADMIN_REVOKE", undefined, note);

  const after = Number(
    (await tx.user.findUnique({ where: { id: userId }, select: { balance: true } }))
      ?.balance ?? 0,
  );

  return { balance: after, revoked: take };
}
