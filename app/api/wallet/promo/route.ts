import { PromoWagerStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activatePromoForDeposit, cancelPromoActivation } from "@/lib/promo";

export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.promoActivation.findFirst({
    where: { userId, status: PromoWagerStatus.WAITING_DEPOSIT },
    include: { promoCode: true },
  });

  const wagering = await prisma.promoActivation.findMany({
    where: { userId, status: PromoWagerStatus.WAGERING },
    include: { promoCode: true },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json({
    pending: pending
      ? {
          id: pending.id,
          code: pending.promoCode.code,
          depositBonusPercent: pending.promoCode.depositBonusPercent,
          wagerMultiplier: pending.promoCode.wagerMultiplier,
        }
      : null,
    wagering: wagering.map((w) => ({
      id: w.id,
      code: w.promoCode.code,
      wagerRequired: w.wagerRequired,
      wagerProgress: w.wagerProgress,
      depositAmount: w.depositAmount,
      bonusAmount: w.bonusAmount,
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Введите промокод" }, { status: 400 });
  }

  try {
    const activation = await prisma.$transaction((tx) =>
      activatePromoForDeposit(tx, userId, code),
    );

    return NextResponse.json({
      ok: true,
      pending: {
        id: activation.id,
        code: activation.promoCode.code,
        depositBonusPercent: activation.promoCode.depositBonusPercent,
        wagerMultiplier: activation.promoCode.wagerMultiplier,
        hint: `Бонус ${activation.promoCode.depositBonusPercent}% к следующему депозиту. Отыгрыш ×${activation.promoCode.wagerMultiplier} от (депозит + бонус).`,
      },
    });
  } catch (err) {
    const map: Record<string, string> = {
      INVALID_PROMO: "Промокод не найден",
      EXPIRED_PROMO: "Промокод истёк",
      PROMO_LIMIT: "Промокод исчерпан",
      ALREADY_USED: "Вы уже использовали этот промокод",
      WAGER_ACTIVE: "Сначала отмените или отыграйте текущий бонус",
    };
    const msg =
      err instanceof Error
        ? map[err.message] || "Ошибка активации"
        : "Ошибка активации";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activationId =
    new URL(req.url).searchParams.get("activationId")?.trim() ||
    String((await req.json().catch(() => null))?.activationId ?? "").trim();

  try {
    if (activationId) {
      const { balance } = await prisma.$transaction((tx) =>
        cancelPromoActivation(tx, userId, activationId),
      );
      return NextResponse.json({ ok: true, balance });
    }

    await prisma.promoActivation.updateMany({
      where: { userId, status: PromoWagerStatus.WAITING_DEPOSIT },
      data: { status: PromoWagerStatus.CANCELLED },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    return NextResponse.json({ ok: true, balance: Number(user?.balance ?? 0) });
  } catch (err) {
    const map: Record<string, string> = {
      NOT_FOUND: "Промокод не найден",
      CANNOT_CANCEL_COMPLETED: "Промокод уже отыгран",
      INSUFFICIENT_FUNDS: "Недостаточно средств для списания бонуса",
    };
    const msg =
      err instanceof Error ? map[err.message] || "Ошибка отмены" : "Ошибка отмены";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
