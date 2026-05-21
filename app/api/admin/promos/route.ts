import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ promos });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const bonusAmount = Number(body?.bonusAmount ?? 0);
  const maxUses =
    body?.maxUses == null || body?.maxUses === ""
      ? null
      : Number(body.maxUses);

  if (!code || code.length < 3) {
    return NextResponse.json({ error: "Код минимум 3 символа" }, { status: 400 });
  }
  if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) {
    return NextResponse.json({ error: "Бонус должен быть > 0" }, { status: 400 });
  }

  try {
    const promo = await prisma.promoCode.create({
      data: {
        code,
        bonusAmount,
        maxUses: Number.isFinite(maxUses) ? maxUses : null,
        expiresAt: body?.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    return NextResponse.json({ promo });
  } catch {
    return NextResponse.json({ error: "Такой код уже есть" }, { status: 409 });
  }
}
