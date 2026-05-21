import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { creditUserBalance } from "@/lib/wallet";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      balance: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      balance: Number(u.balance),
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "Выдача админом").trim().slice(0, 200);

  if (!username) {
    return NextResponse.json({ error: "Укажите ник" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Сумма должна быть > 0" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const balance = await prisma.$transaction((tx) =>
    creditUserBalance(tx, target.id, amount, "ADMIN_GRANT", undefined, note),
  );

  return NextResponse.json({
    ok: true,
    username: target.username,
    balance,
  });
}
