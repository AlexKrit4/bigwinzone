import { WithdrawalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { creditUserBalance } from "@/lib/wallet";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const withdrawals = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { username: true, email: true, balance: true } },
    },
  });

  return NextResponse.json({
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      username: w.user.username,
      email: w.user.email,
      userBalance: Number(w.user.balance),
      amount: Number(w.amount),
      payoutTo: w.payoutTo,
      status: w.status,
      userNote: w.userNote,
      adminNote: w.adminNote,
      createdAt: w.createdAt,
      processedAt: w.processedAt,
    })),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const action = String(body?.action ?? "");
  const adminNote = String(body?.adminNote ?? "").trim().slice(0, 500);

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id },
  });
  if (!withdrawal || withdrawal.status !== WithdrawalStatus.PENDING) {
    return NextResponse.json({ error: "Заявка не найдена или уже обработана" }, { status: 404 });
  }

  if (action === "approve" || action === "paid") {
    await prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: action === "paid" ? WithdrawalStatus.PAID : WithdrawalStatus.APPROVED,
        adminNote: adminNote || null,
        processedById: gate.user!.id,
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    await prisma.$transaction(async (tx) => {
      await creditUserBalance(
        tx,
        withdrawal.userId,
        withdrawal.amount,
        "WITHDRAW_REFUND",
        withdrawal.id,
        "Отклонение заявки на вывод",
      );
      await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: WithdrawalStatus.REJECTED,
          adminNote: adminNote || "Отклонено",
          processedById: gate.user!.id,
          processedAt: new Date(),
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action: approve | paid | reject" }, { status: 400 });
}
