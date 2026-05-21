import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditUserBalance } from "@/lib/wallet";

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
    const balance = await prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { code } });
      if (!promo || !promo.active) {
        throw new Error("INVALID_PROMO");
      }
      if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw new Error("EXPIRED_PROMO");
      }
      if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
        throw new Error("PROMO_LIMIT");
      }

      const already = await tx.promoRedemption.findUnique({
        where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
      });
      if (already) throw new Error("ALREADY_USED");

      await tx.promoRedemption.create({
        data: { promoCodeId: promo.id, userId },
      });
      await tx.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });

      return creditUserBalance(
        tx,
        userId,
        promo.bonusAmount,
        "PROMO",
        promo.id,
        `Промокод ${code}`,
      );
    });

    return NextResponse.json({ balance, ok: true });
  } catch (err) {
    const map: Record<string, string> = {
      INVALID_PROMO: "Промокод не найден",
      EXPIRED_PROMO: "Промокод истёк",
      PROMO_LIMIT: "Промокод исчерпан",
      ALREADY_USED: "Вы уже использовали этот промокод",
    };
    const msg =
      err instanceof Error
        ? map[err.message] || "Ошибка активации"
        : "Ошибка активации";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
