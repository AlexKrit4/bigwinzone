import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const [usersCount, totalBalance, pendingWithdrawals, depositsSum] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.aggregate({ _sum: { balance: true } }),
      prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
      prisma.deposit.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

  return NextResponse.json({
    usersCount,
    totalBalance: Number(totalBalance._sum.balance ?? 0),
    pendingWithdrawals,
    depositsTotal: Number(depositsSum._sum.amount ?? 0),
  });
}
