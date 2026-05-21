import { DepositStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildYooMoneyPaymentUrl, isYooMoneyConfigured } from "@/lib/yoomoney";

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isYooMoneyConfigured()) {
    return NextResponse.json(
      { error: "ЮMoney не настроен на сервере (YOOMONEY_WALLET, YOOMONEY_SECRET)" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount ?? 0);

  if (!Number.isFinite(amount) || amount < 50 || amount > 500_000) {
    return NextResponse.json(
      { error: "Сумма депозита: от 50 до 500 000 ₽" },
      { status: 400 },
    );
  }

  const deposit = await prisma.deposit.create({
    data: {
      userId,
      amount,
      status: DepositStatus.PENDING,
      label: `dep_${cryptoRandom()}`,
    },
  });

  const paymentUrl = buildYooMoneyPaymentUrl(amount, deposit.label);

  return NextResponse.json({
    depositId: deposit.id,
    label: deposit.label,
    amount,
    paymentUrl,
  });
}

function cryptoRandom() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
