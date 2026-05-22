import type { Prisma } from "@prisma/client";
import {
  type BalanceBucket,
  creditBucket,
  debitBucket,
  getUserBalances,
  totalBalance,
} from "@/lib/balances";

type Tx = Prisma.TransactionClient;

/** Зачисление на реальные деньги (депозит без промо, вывод и т.д.). */
export async function creditUserBalance(
  tx: Tx,
  userId: string,
  amount: number,
  type: string,
  refId?: string,
  note?: string,
  bucket: BalanceBucket = "cash",
) {
  const balances = await creditBucket(tx, userId, bucket, amount, type, refId, note);
  return totalBalance(balances);
}

export async function debitUserBalance(
  tx: Tx,
  userId: string,
  amount: number,
  type: string,
  refId?: string,
  note?: string,
  bucket: BalanceBucket = "cash",
) {
  const balances = await debitBucket(tx, userId, bucket, amount, type, refId, note);
  return totalBalance(balances);
}

export async function getTotalBalance(tx: Tx, userId: string) {
  const b = await getUserBalances(tx, userId);
  return totalBalance(b);
}

export function publicUser(user: {
  id: string;
  email: string;
  username: string;
  balance: number | { toString(): string };
  balanceCash?: number | { toString(): string };
  balanceBonus?: number | { toString(): string };
  balancePromoDeposit?: number | { toString(): string };
  role: string;
}) {
  const cash = Number(user.balanceCash ?? user.balance);
  const bonus = Number(user.balanceBonus ?? 0);
  const promoDeposit = Number(user.balancePromoDeposit ?? 0);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    balance: totalBalance({ cash, bonus, promoDeposit }),
    cash,
    bonus,
    promoDeposit,
    role: user.role,
  };
}
