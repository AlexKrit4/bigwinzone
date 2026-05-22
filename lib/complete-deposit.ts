import { DepositStatus, type Prisma } from "@prisma/client";
import { applyPromoOnDeposit } from "@/lib/promo";
import { creditUserBalance } from "@/lib/wallet";

type Tx = Prisma.TransactionClient;

const MAX_COMMISSION_RATIO = 0.05;

export type DepositToComplete = {
  id: string;
  userId: string;
  status: DepositStatus;
  amount: number | { toString(): string };
  externalId: string | null;
  promoCodeId?: string | null;
};

export type DepositPaymentInfo = {
  walletAmount: number;
  withdrawAmount?: number;
  operationId: string;
  ledgerNote: string;
};

export function assertDepositPaymentMatches(
  expected: number,
  walletAmount: number,
  withdrawAmount?: number,
) {
  if (withdrawAmount != null && Number.isFinite(withdrawAmount)) {
    if (Math.abs(withdrawAmount - expected) > 0.01) {
      throw new Error("WITHDRAW_AMOUNT_MISMATCH");
    }
    return;
  }

  const minNet = expected * (1 - MAX_COMMISSION_RATIO) - 0.01;
  if (walletAmount + 0.01 < minNet) {
    throw new Error("UNDERPAID");
  }
}

export async function completeDepositPayment(
  tx: Tx,
  deposit: DepositToComplete,
  payment: DepositPaymentInfo,
): Promise<"completed" | "already" | "duplicate"> {
  if (deposit.status === DepositStatus.COMPLETED) {
    return "already";
  }

  if (deposit.externalId === payment.operationId) {
    return "already";
  }

  const existingOp = await tx.deposit.findUnique({
    where: { externalId: payment.operationId },
  });
  if (existingOp) {
    return "duplicate";
  }

  const expected = Number(deposit.amount);
  assertDepositPaymentMatches(
    expected,
    payment.walletAmount,
    payment.withdrawAmount,
  );

  const fullDeposit = await tx.deposit.findUnique({
    where: { id: deposit.id },
    select: { promoCodeId: true },
  });

  if (!fullDeposit?.promoCodeId) {
    await creditUserBalance(
      tx,
      deposit.userId,
      expected,
      "DEPOSIT",
      deposit.id,
      payment.ledgerNote,
      "cash",
    );
  }

  await tx.deposit.update({
    where: { id: deposit.id },
    data: {
      status: DepositStatus.COMPLETED,
      externalId: payment.operationId,
      completedAt: new Date(),
      amount: expected,
    },
  });

  if (fullDeposit?.promoCodeId) {
    await applyPromoOnDeposit(tx, deposit.id, deposit.userId, expected);
  }

  return "completed";
}
