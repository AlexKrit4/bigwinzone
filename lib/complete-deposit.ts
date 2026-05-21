import { DepositStatus, type Prisma } from "@prisma/client";
import { applyPromoOnDeposit } from "@/lib/promo";
import { creditUserBalance } from "@/lib/wallet";

type Tx = Prisma.TransactionClient;

/** Допуск комиссии ЮMoney: на кошелёк может прийти меньше, чем сумма депозита. */
const MAX_COMMISSION_RATIO = 0.05;

export type DepositToComplete = {
  id: string;
  userId: string;
  status: DepositStatus;
  amount: number | { toString(): string };
  externalId: string | null;
};

export type DepositPaymentInfo = {
  /** Сумма, зачисленная на кошелёк ЮMoney (после комиссии). */
  walletAmount: number;
  /** Сумма, списанная с плательщика (если есть в уведомлении). */
  withdrawAmount?: number;
  operationId: string;
  ledgerNote: string;
};

/** Проверка, что платёж относится к ожидаемому депозиту. */
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

/**
 * Зачислить на баланс казино полную сумму депозита (expected),
 * даже если на кошелёк ЮMoney пришло меньше из‑за комиссии.
 */
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

  if (Math.abs(payment.walletAmount - expected) > 0.01) {
    console.log(
      `[deposit] commission: id=${deposit.id} credit=${expected} wallet=${payment.walletAmount}`,
      payment.withdrawAmount != null ? `paid=${payment.withdrawAmount}` : "",
    );
  }

  await creditUserBalance(
    tx,
    deposit.userId,
    expected,
    "DEPOSIT",
    deposit.id,
    payment.ledgerNote,
  );

  await tx.deposit.update({
    where: { id: deposit.id },
    data: {
      status: DepositStatus.COMPLETED,
      externalId: payment.operationId,
      completedAt: new Date(),
      amount: expected,
    },
  });

  await applyPromoOnDeposit(tx, deposit.id, deposit.userId, expected);
  return "completed";
}
