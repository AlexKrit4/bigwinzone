import type { Prisma } from "@prisma/client";
import { PromoWagerStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type BalanceBucket = "cash" | "bonus" | "promoDeposit";

export type UserBalances = {
  cash: number;
  bonus: number;
  promoDeposit: number;
};

const BUCKET_FIELD: Record<BalanceBucket, keyof UserBalances> = {
  cash: "cash",
  bonus: "bonus",
  promoDeposit: "promoDeposit",
};

const DB_FIELD: Record<BalanceBucket, "balanceCash" | "balanceBonus" | "balancePromoDeposit"> = {
  cash: "balanceCash",
  bonus: "balanceBonus",
  promoDeposit: "balancePromoDeposit",
};

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function totalBalance(b: UserBalances) {
  return roundMoney(b.cash + b.bonus + b.promoDeposit);
}

export function mapUserBalances(user: {
  balanceCash: number | { toString(): string };
  balanceBonus: number | { toString(): string };
  balancePromoDeposit: number | { toString(): string };
}): UserBalances {
  return {
    cash: Number(user.balanceCash),
    bonus: Number(user.balanceBonus),
    promoDeposit: Number(user.balancePromoDeposit),
  };
}

async function syncLegacyBalance(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      balanceCash: true,
      balanceBonus: true,
      balancePromoDeposit: true,
    },
  });
  if (!user) return;
  const total = totalBalance(mapUserBalances(user));
  await tx.user.update({
    where: { id: userId },
    data: { balance: total },
  });
}

export async function getUserBalances(tx: Tx, userId: string): Promise<UserBalances> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      balanceCash: true,
      balanceBonus: true,
      balancePromoDeposit: true,
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  return mapUserBalances(user);
}

export async function creditBucket(
  tx: Tx,
  userId: string,
  bucket: BalanceBucket,
  amount: number,
  type: string,
  refId?: string,
  note?: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");

  const field = DB_FIELD[bucket];
  const user = await tx.user.update({
    where: { id: userId },
    data: { [field]: { increment: amount } },
    select: {
      balanceCash: true,
      balanceBonus: true,
      balancePromoDeposit: true,
    },
  });

  const balances = mapUserBalances(user);
  await tx.balanceLedger.create({
    data: {
      userId,
      amount,
      balanceAfter: totalBalance(balances),
      type,
      refId,
      note: note ? `${bucket}:${note}` : bucket,
    },
  });
  await syncLegacyBalance(tx, userId);
  return balances;
}

export async function debitBucket(
  tx: Tx,
  userId: string,
  bucket: BalanceBucket,
  amount: number,
  type: string,
  refId?: string,
  note?: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");

  const current = await getUserBalances(tx, userId);
  const available = current[BUCKET_FIELD[bucket]];
  if (available + 0.001 < amount) throw new Error("INSUFFICIENT_FUNDS");

  const field = DB_FIELD[bucket];
  const user = await tx.user.update({
    where: { id: userId },
    data: { [field]: { decrement: amount } },
    select: {
      balanceCash: true,
      balanceBonus: true,
      balancePromoDeposit: true,
    },
  });

  const balances = mapUserBalances(user);
  await tx.balanceLedger.create({
    data: {
      userId,
      amount: -amount,
      balanceAfter: totalBalance(balances),
      type,
      refId,
      note: note ? `${bucket}:${note}` : bucket,
    },
  });
  await syncLegacyBalance(tx, userId);
  return balances;
}

/** Активный отыгрыш промо (депозитный или ADM). */
export async function getActiveWagerPromo(tx: Tx, userId: string) {
  return tx.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAGERING },
    orderBy: { appliedAt: "desc" },
    include: { promoCode: true },
  });
}

/**
 * Списать ставку и зачислить выигрыш по правилам промо.
 * С промо: ставка с promoDeposit → bonus; выигрыш в bonus.
 * Без promoDeposit: ставка и выигрыш с/в bonus.
 * Без промо: cash.
 */
export async function settleSpin(tx: Tx, userId: string, bet: number, win: number) {
  const betAmt = roundMoney(Math.max(0, bet));
  const winAmt = roundMoney(Math.max(0, win));

  let balances = await getUserBalances(tx, userId);
  const active = await getActiveWagerPromo(tx, userId);

  if (betAmt > totalBalance(balances) + 0.001) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  if (active) {
    let betLeft = betAmt;

    if (balances.promoDeposit > 0.001) {
      const fromPromo = Math.min(balances.promoDeposit, betLeft);
      if (fromPromo > 0) {
        balances = await debitBucket(tx, userId, "promoDeposit", fromPromo, "SPIN_BET");
        betLeft = roundMoney(betLeft - fromPromo);
      }
    }

    if (betLeft > 0.001) {
      balances = await debitBucket(tx, userId, "bonus", betLeft, "SPIN_BET");
    }

    if (winAmt > 0) {
      balances = await creditBucket(tx, userId, "bonus", winAmt, "SPIN_WIN");
    }
  } else {
    if (betAmt > 0) {
      balances = await debitBucket(tx, userId, "cash", betAmt, "SPIN_BET");
    }
    if (winAmt > 0) {
      balances = await creditBucket(tx, userId, "cash", winAmt, "SPIN_WIN");
    }
  }

  return { balances, total: totalBalance(balances) };
}

/** Отыгрыш завершён: бонус + депозит под промо → реальные деньги. */
export async function releasePromoBalancesToCash(tx: Tx, userId: string) {
  let balances = await getUserBalances(tx, userId);
  const moveBonus = balances.bonus;
  const movePromo = balances.promoDeposit;

  if (movePromo > 0.001) {
    await debitBucket(tx, userId, "promoDeposit", movePromo, "PROMO_RELEASE");
    await creditBucket(tx, userId, "cash", movePromo, "PROMO_RELEASE");
  }
  balances = await getUserBalances(tx, userId);
  if (moveBonus > 0.001) {
    await debitBucket(tx, userId, "bonus", moveBonus, "PROMO_RELEASE");
    await creditBucket(tx, userId, "cash", moveBonus, "PROMO_RELEASE");
  }

  return getUserBalances(tx, userId);
}

/** Отмена промо: обнулить бонус, остаток депозита под промо → cash. */
export async function cancelPromoBalances(tx: Tx, userId: string) {
  let balances = await getUserBalances(tx, userId);

  if (balances.bonus > 0.001) {
    await debitBucket(tx, userId, "bonus", balances.bonus, "PROMO_CANCEL");
  }

  balances = await getUserBalances(tx, userId);
  if (balances.promoDeposit > 0.001) {
    const move = balances.promoDeposit;
    await debitBucket(tx, userId, "promoDeposit", move, "PROMO_CANCEL");
    await creditBucket(tx, userId, "cash", move, "PROMO_CANCEL");
  }

  return getUserBalances(tx, userId);
}

/** Списание только с реальных денег (админ). */
export async function adminRevokeCash(tx: Tx, userId: string, amount: number, note: string) {
  const balances = await getUserBalances(tx, userId);
  const take = Math.min(amount, balances.cash);
  if (take <= 0.001) throw new Error("NOTHING_TO_REVOKE");
  const after = await debitBucket(tx, userId, "cash", take, "ADMIN_REVOKE", undefined, note);
  return { balances: after, revoked: take, total: totalBalance(after) };
}

export function balancesResponse(b: UserBalances) {
  return {
    balance: totalBalance(b),
    cash: b.cash,
    bonus: b.bonus,
    promoDeposit: b.promoDeposit,
  };
}
