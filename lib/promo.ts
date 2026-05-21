import type { Prisma } from "@prisma/client";
import { PromoWagerStatus } from "@prisma/client";
import { creditUserBalance, debitUserBalance } from "@/lib/wallet";

type Tx = Prisma.TransactionClient;

export function calcDepositBonus(depositAmount: number, bonusPercent: number) {
  const pct = Math.max(0, Number(bonusPercent) || 0);
  const base = Math.max(0, Number(depositAmount) || 0);
  return Math.round(base * (pct / 100) * 100) / 100;
}

export function calcWagerRequired(
  depositAmount: number,
  bonusAmount: number,
  wagerMultiplier: number,
) {
  const mult = Math.max(0, Number(wagerMultiplier) || 0);
  const total = Math.max(0, Number(depositAmount) || 0) + Math.max(0, Number(bonusAmount) || 0);
  return Math.round(total * mult * 100) / 100;
}

export async function getPendingPromoActivation(tx: Tx, userId: string) {
  return tx.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAITING_DEPOSIT },
    include: { promoCode: true },
  });
}

export async function activatePromoForDeposit(tx: Tx, userId: string, code: string) {
  const promo = await tx.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!promo || !promo.active) throw new Error("INVALID_PROMO");
  if (promo.expiresAt && promo.expiresAt < new Date()) throw new Error("EXPIRED_PROMO");
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    throw new Error("PROMO_LIMIT");
  }

  const usedBefore = await tx.promoActivation.findUnique({
    where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
  });
  if (usedBefore && usedBefore.status !== PromoWagerStatus.CANCELLED) {
    throw new Error("ALREADY_USED");
  }

  const activeWager = await tx.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAGERING },
  });
  if (activeWager) throw new Error("WAGER_ACTIVE");

  await tx.promoActivation.deleteMany({
    where: { userId, status: PromoWagerStatus.WAITING_DEPOSIT },
  });

  if (usedBefore?.status === PromoWagerStatus.CANCELLED) {
    return tx.promoActivation.update({
      where: { id: usedBefore.id },
      data: {
        status: PromoWagerStatus.WAITING_DEPOSIT,
        depositId: null,
        depositAmount: 0,
        bonusAmount: 0,
        wagerRequired: 0,
        wagerProgress: 0,
        appliedAt: null,
        completedAt: null,
        createdAt: new Date(),
      },
      include: { promoCode: true },
    });
  }

  return tx.promoActivation.create({
    data: { userId, promoCodeId: promo.id, status: PromoWagerStatus.WAITING_DEPOSIT },
    include: { promoCode: true },
  });
}

/** Применить промо после успешного депозита */
export async function applyPromoOnDeposit(
  tx: Tx,
  depositId: string,
  userId: string,
  paidAmount: number,
) {
  const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
  if (!deposit?.promoCodeId) return null;

  const activation = await tx.promoActivation.findFirst({
    where: {
      userId,
      promoCodeId: deposit.promoCodeId,
      status: PromoWagerStatus.WAITING_DEPOSIT,
    },
    include: { promoCode: true },
  });
  if (!activation) return null;

  const bonus = calcDepositBonus(paidAmount, activation.promoCode.depositBonusPercent);
  const wagerRequired = calcWagerRequired(
    paidAmount,
    bonus,
    activation.promoCode.wagerMultiplier,
  );

  if (bonus > 0) {
    await creditUserBalance(
      tx,
      userId,
      bonus,
      "PROMO_DEPOSIT_BONUS",
      activation.id,
      `Бонус ${activation.promoCode.code} +${activation.promoCode.depositBonusPercent}%`,
    );
  }

  await tx.promoCode.update({
    where: { id: activation.promoCodeId },
    data: { usedCount: { increment: 1 } },
  });

  await tx.deposit.update({
    where: { id: depositId },
    data: { bonusAmount: bonus },
  });

  return tx.promoActivation.update({
    where: { id: activation.id },
    data: {
      status: PromoWagerStatus.WAGERING,
      depositId,
      depositAmount: paidAmount,
      bonusAmount: bonus,
      wagerRequired,
      wagerProgress: 0,
      appliedAt: new Date(),
    },
    include: { promoCode: true },
  });
}

export async function addWagerProgress(tx: Tx, userId: string, betAmount: number) {
  if (!Number.isFinite(betAmount) || betAmount <= 0) return;

  const active = await tx.promoActivation.findMany({
    where: { userId, status: PromoWagerStatus.WAGERING },
  });

  for (const act of active) {
    const progress = Math.min(
      act.wagerRequired,
      Math.round((act.wagerProgress + betAmount) * 100) / 100,
    );
    const done = progress >= act.wagerRequired - 0.001;
    await tx.promoActivation.update({
      where: { id: act.id },
      data: {
        wagerProgress: progress,
        status: done ? PromoWagerStatus.COMPLETED : PromoWagerStatus.WAGERING,
        completedAt: done ? new Date() : null,
      },
    });
  }
}

/** Отменить активный промо: WAITING_DEPOSIT или WAGERING (бонус списывается с баланса). */
export async function cancelPromoActivation(
  tx: Tx,
  userId: string,
  activationId: string,
) {
  const activation = await tx.promoActivation.findFirst({
    where: { id: activationId, userId },
    include: { promoCode: true },
  });
  if (!activation) throw new Error("NOT_FOUND");

  if (activation.status === PromoWagerStatus.CANCELLED) {
    return { activation, balance: await getUserBalance(tx, userId) };
  }

  if (activation.status === PromoWagerStatus.COMPLETED) {
    throw new Error("CANNOT_CANCEL_COMPLETED");
  }

  const bonus = Number(activation.bonusAmount);

  if (activation.status === PromoWagerStatus.WAGERING && bonus > 0) {
    await debitUserBalance(
      tx,
      userId,
      bonus,
      "PROMO_CANCEL",
      activation.id,
      `Отмена промо ${activation.promoCode.code}`,
    );

    const promo = await tx.promoCode.findUnique({
      where: { id: activation.promoCodeId },
      select: { usedCount: true },
    });
    if (promo && promo.usedCount > 0) {
      await tx.promoCode.update({
        where: { id: activation.promoCodeId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    if (activation.depositId) {
      await tx.deposit.update({
        where: { id: activation.depositId },
        data: { bonusAmount: 0 },
      });
    }
  }

  await tx.promoActivation.update({
    where: { id: activation.id },
    data: {
      status: PromoWagerStatus.CANCELLED,
      wagerProgress: 0,
      wagerRequired: 0,
      completedAt: null,
    },
  });

  const balance = await getUserBalance(tx, userId);
  return { activation, balance };
}

async function getUserBalance(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  return Number(user.balance);
}

export async function assertCanWithdraw(tx: Tx, userId: string) {
  const blocking = await tx.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAGERING },
  });
  if (!blocking) return;

  const left = Math.max(0, blocking.wagerRequired - blocking.wagerProgress);
  throw new Error(`WAGER_INCOMPLETE:${left.toFixed(2)}`);
}
