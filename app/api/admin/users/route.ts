import { NextResponse } from "next/server";
import { createAdminGrant, adminRevokeBalance } from "@/lib/admin-grant";
import { requireAdmin } from "@/lib/admin";
import { balancesResponse } from "@/lib/balances";
import { prisma } from "@/lib/prisma";
import { publicUser } from "@/lib/wallet";

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
      balanceCash: true,
      balanceBonus: true,
      balancePromoDeposit: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((u) => publicUser(u)),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "grant").trim().toLowerCase();
  const username = String(body?.username ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim().slice(0, 200);

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

  try {
    if (action === "revoke") {
      const result = await prisma.$transaction((tx) =>
        adminRevokeBalance(
          tx,
          target.id,
          amount,
          note || "Списание админом (реальные деньги)",
        ),
      );
      return NextResponse.json({
        ok: true,
        action: "revoke",
        username: target.username,
        revoked: result.revoked,
        ...balancesResponse(result.balances),
      });
    }

    const wagerMultiplier = Number(body?.wagerMultiplier ?? 0);
    if (!Number.isFinite(wagerMultiplier) || wagerMultiplier < 0) {
      return NextResponse.json({ error: "Вейджер × должен быть ≥ 0" }, { status: 400 });
    }

    const result = await prisma.$transaction((tx) =>
      createAdminGrant(
        tx,
        target.id,
        amount,
        wagerMultiplier,
        note || `Бонус админа ×${wagerMultiplier}`,
      ),
    );

    return NextResponse.json({
      ok: true,
      action: "grant",
      username: target.username,
      code: result.code,
      wagerRequired: result.activation.wagerRequired,
      ...balancesResponse({
        cash: result.cash,
        bonus: result.bonus,
        promoDeposit: result.promoDeposit,
      }),
    });
  } catch (err) {
    const map: Record<string, string> = {
      INVALID_AMOUNT: "Некорректная сумма",
      INVALID_WAGER: "Некорректный вейджер",
      ADMIN_GRANT_ACTIVE: "У игрока уже есть активный ADM-бонус",
      WAGER_ACTIVE: "У игрока активен промокод — сначала отмените или отыграйте",
      NOTHING_TO_REVOKE: "Нет реальных денег для списания",
      INSUFFICIENT_FUNDS: "Недостаточно средств",
    };
    const msg =
      err instanceof Error ? map[err.message] || "Ошибка операции" : "Ошибка операции";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
