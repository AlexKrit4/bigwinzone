import { DepositStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { completeDepositPayment } from "@/lib/complete-deposit";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const deposits = await prisma.deposit.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { username: true, email: true } },
    },
  });

  return NextResponse.json({
    deposits: deposits.map((d) => ({
      id: d.id,
      username: d.user.username,
      email: d.user.email,
      amount: Number(d.amount),
      bonusAmount: Number(d.bonusAmount),
      status: d.status,
      provider: d.provider,
      label: d.label,
      externalId: d.externalId,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    })),
  });
}

/** Ручное подтверждение зависшего PENDING (деньги уже в кошельке ЮMoney). */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const depositId = String(body?.depositId ?? "").trim();
  const operationId = String(body?.operationId ?? "").trim();

  if (!depositId) {
    return NextResponse.json({ error: "depositId обязателен" }, { status: 400 });
  }

  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) {
    return NextResponse.json({ error: "Депозит не найден" }, { status: 404 });
  }
  if (deposit.status !== DepositStatus.PENDING) {
    return NextResponse.json({ error: "Депозит уже обработан" }, { status: 400 });
  }

  const opId = operationId || `manual_${deposit.id}`;

  try {
    const result = await prisma.$transaction(async (tx) =>
      completeDepositPayment(tx, deposit, {
        walletAmount: Number(deposit.amount),
        withdrawAmount: Number(deposit.amount),
        operationId: opId,
        ledgerNote: `Ручное подтверждение (${opId})`,
      }),
    );

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[admin] complete deposit", err);
    return NextResponse.json({ error: "Ошибка зачисления" }, { status: 500 });
  }
}
