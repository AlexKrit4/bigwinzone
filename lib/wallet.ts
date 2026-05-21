import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function creditUserBalance(
  tx: Tx,
  userId: string,
  amount: number,
  type: string,
  refId?: string,
  note?: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  const balanceAfter = Number(user.balance) + amount;
  await tx.user.update({
    where: { id: userId },
    data: { balance: balanceAfter },
  });
  await tx.balanceLedger.create({
    data: { userId, amount, balanceAfter, type, refId, note },
  });
  return balanceAfter;
}

export async function debitUserBalance(
  tx: Tx,
  userId: string,
  amount: number,
  type: string,
  refId?: string,
  note?: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  if (Number(user.balance) < amount) throw new Error("INSUFFICIENT_FUNDS");

  const balanceAfter = Number(user.balance) - amount;
  await tx.user.update({
    where: { id: userId },
    data: { balance: balanceAfter },
  });
  await tx.balanceLedger.create({
    data: { userId, amount: -amount, balanceAfter, type, refId, note },
  });
  return balanceAfter;
}

export function publicUser(user: {
  id: string;
  email: string;
  username: string;
  balance: number | { toString(): string };
  role: string;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    balance: Number(user.balance),
    role: user.role,
  };
}
