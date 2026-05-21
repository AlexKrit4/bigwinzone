import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Статус депозита по метке (опрос после возврата с ЮMoney). */
export async function GET(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const label = new URL(req.url).searchParams.get("label")?.trim();
  if (!label) {
    return NextResponse.json({ error: "label обязателен" }, { status: 400 });
  }

  const deposit = await prisma.deposit.findFirst({
    where: { label, userId },
    select: {
      id: true,
      status: true,
      amount: true,
      bonusAmount: true,
      createdAt: true,
      completedAt: true,
    },
  });

  if (!deposit) {
    return NextResponse.json({ error: "Депозит не найден" }, { status: 404 });
  }

  return NextResponse.json({
    status: deposit.status,
    amount: Number(deposit.amount),
    bonusAmount: Number(deposit.bonusAmount),
    completedAt: deposit.completedAt,
  });
}
