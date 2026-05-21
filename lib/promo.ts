import type { Prisma } from "@prisma/client";
import { PromoWagerStatus } from "@prisma/client";
import { creditUserBalance } from "@/lib/wallet";

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

export async function assertCanWithdraw(tx: Tx, userId: string) {
  const blocking = await tx.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAGERING },
  });
  if (!blocking) return;

  const left = Math.max(0, blocking.wagerRequired - blocking.wagerProgress);
  throw new Error(`WAGER_INCOMPLETE:${left.toFixed(2)}`);
}
