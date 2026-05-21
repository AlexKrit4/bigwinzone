import { DepositStatus, type Prisma } from "@prisma/client";
import { applyPromoOnDeposit } from "@/lib/promo";
import { creditUserBalance } from "@/lib/wallet";

type Tx = Prisma.TransactionClient;

export type DepositToComplete = {
  id: string;
  userId: string;
  status: DepositStatus;
  amount: number | { toString(): string };
  externalId: string | null;
};

/** Зачислить депозит и применить промо (идемпотентно по operationId). */
export async function completeDepositPayment(
  tx: Tx,
  deposit: DepositToComplete,
  paidAmount: number,
  operationId: string,
  ledgerNote: string,
): Promise<"completed" | "already" | "duplicate"> {
  if (deposit.status === DepositStatus.COMPLETED) {
    return "already";
  }

  if (deposit.externalId === operationId) {
    return "already";
  }

  const existingOp = await tx.deposit.findUnique({
    where: { externalId: operationId },
  });
  if (existingOp) {
    return "duplicate";
  }

  const expected = Number(deposit.amount);
  if (Math.abs(paidAmount - expected) > 0.01) {
    console.warn(
      `[deposit] amount mismatch id=${deposit.id} expected=${expected} got=${paidAmount}`,
    );
  }

  await creditUserBalance(
    tx,
    deposit.userId,
    paidAmount,
    "DEPOSIT",
    deposit.id,
    ledgerNote,
  );

  await tx.deposit.update({
    where: { id: deposit.id },
    data: {
      status: DepositStatus.COMPLETED,
      externalId: operationId,
      completedAt: new Date(),
      amount: paidAmount,
    },
  });

  await applyPromoOnDeposit(tx, deposit.id, deposit.userId, paidAmount);
  return "completed";
}
