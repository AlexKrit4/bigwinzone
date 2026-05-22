import { WithdrawalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { balancesResponse, getUserBalances } from "@/lib/balances";
import { assertCanWithdraw } from "@/lib/promo";
import { debitUserBalance } from "@/lib/wallet";

export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      amount: true,
      payoutTo: true,
      status: true,
      userNote: true,
      adminNote: true,
      createdAt: true,
      processedAt: true,
    },
  });

  return NextResponse.json({ withdrawals: items });
}

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount ?? 0);
  const payoutTo = String(body?.payoutTo ?? "").trim();
  const userNote = String(body?.note ?? "").trim().slice(0, 500);

  if (!Number.isFinite(amount) || amount < 100) {
    return NextResponse.json(
      { error: "Минимальная сумма вывода — 100 ₽" },
      { status: 400 },
    );
  }

  if (payoutTo.length < 8) {
    return NextResponse.json(
      { error: "Укажите кошелёк ЮMoney (номер или телефон)" },
      { status: 400 },
    );
  }

  const pending = await prisma.withdrawalRequest.count({
    where: { userId, status: WithdrawalStatus.PENDING },
  });
  if (pending > 0) {
    return NextResponse.json(
      { error: "У вас уже есть заявка на вывод в обработке" },
      { status: 409 },
    );
  }

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      await assertCanWithdraw(tx, userId);
      await debitUserBalance(
        tx,
        userId,
        amount,
        "WITHDRAW_HOLD",
        undefined,
        "Заявка на вывод",
        "cash",
      );

      return tx.withdrawalRequest.create({
        data: {
          userId,
          amount,
          payoutTo,
          userNote: userNote || null,
          status: WithdrawalStatus.PENDING,
        },
      });
    });

    const balances = await prisma.$transaction((tx) => getUserBalances(tx, userId));

    return NextResponse.json({
      withdrawal: { id: withdrawal.id, status: withdrawal.status },
      ...balancesResponse(balances),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ error: "Недостаточно средств" }, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("WAGER_INCOMPLETE:")) {
      const left = err.message.split(":")[1];
      return NextResponse.json(
        {
          error: `Сначала отыграйте бонус. Осталось поставить: ${left} ₽`,
        },
        { status: 400 },
      );
    }
    console.error("[withdraw]", err);
    return NextResponse.json({ error: "Не удалось создать заявку" }, { status: 500 });
  }
}
