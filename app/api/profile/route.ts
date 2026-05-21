import { PromoWagerStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, deposits, withdrawals, activations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true, balance: true, createdAt: true },
    }),
    prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { promoCode: { select: { code: true } } },
    }),
    prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.promoActivation.findMany({
      where: {
        userId,
        status: {
          in: [
            PromoWagerStatus.WAITING_DEPOSIT,
            PromoWagerStatus.WAGERING,
            PromoWagerStatus.COMPLETED,
          ],
        },
      },
      include: { promoCode: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      username: user.username,
      email: user.email,
      balance: Number(user.balance),
      memberSince: user.createdAt,
    },
    deposits: deposits.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      bonusAmount: Number(d.bonusAmount),
      status: d.status,
      promoCode: d.promoCode?.code ?? null,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    })),
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      payoutTo: w.payoutTo,
      status: w.status,
      createdAt: w.createdAt,
      processedAt: w.processedAt,
    })),
    promos: activations.map((a) => ({
      id: a.id,
      code: a.promoCode.code,
      status: a.status,
      depositBonusPercent: a.promoCode.depositBonusPercent,
      wagerMultiplier: a.promoCode.wagerMultiplier,
      depositAmount: a.depositAmount,
      bonusAmount: a.bonusAmount,
      wagerRequired: a.wagerRequired,
      wagerProgress: a.wagerProgress,
      progressPercent:
        a.wagerRequired > 0
          ? Math.min(100, Math.round((a.wagerProgress / a.wagerRequired) * 100))
          : a.status === "COMPLETED"
            ? 100
            : 0,
      appliedAt: a.appliedAt,
      completedAt: a.completedAt,
    })),
  });
}
