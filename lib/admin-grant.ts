import { PromoWagerStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { balancesResponse, creditBucket, getUserBalances } from "@/lib/balances";
import { calcWagerRequired, cancelPromoActivation } from "@/lib/promo";
import { ADMIN_GRANT_CODE_PREFIX } from "@/lib/promo-codes";
import { adminRevokeCash } from "@/lib/balances";

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

/** ADM-бонус → только бонусный счёт, ставки/выигрыши с бонусного. */
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

  const activePromo = await tx.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAGERING },
  });
  if (activePromo) throw new Error("WAGER_ACTIVE");

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

  await creditBucket(tx, userId, "bonus", amount, "ADMIN_GRANT", promo.id, note);

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

  const balances = await getUserBalances(tx, userId);
  return { activation, promo, code, ...balancesResponse(balances) };
}

/** Списание только с реальных денег (не трогает бонус/промо). */
export async function adminRevokeBalance(
  tx: Tx,
  userId: string,
  amount: number,
  note: string,
) {
  return adminRevokeCash(tx, userId, amount, note);
}
