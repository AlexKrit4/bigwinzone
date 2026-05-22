import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { balancesResponse, settleSpin } from "@/lib/balances";
import { addWagerProgress } from "@/lib/promo";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const bet = Number(body?.bet ?? 0);
  const win = Number(body?.win ?? 0);

  if (!Number.isFinite(bet) || bet < 0) {
    return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
  }

  if (!Number.isFinite(win) || win < 0) {
    return NextResponse.json({ error: "Invalid win" }, { status: 400 });
  }

  if (bet === 0 && win === 0) {
    return NextResponse.json({ error: "Empty spin settlement" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settled = await settleSpin(tx, userId, bet, win);
      if (bet > 0) {
        await addWagerProgress(tx, userId, bet);
      }
      return settled;
    });

    return NextResponse.json({
      ...balancesResponse(result.balances),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ error: "Недостаточно средств" }, { status: 400 });
    }

    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("[spin]", err);
    return NextResponse.json({ error: "Spin settlement failed" }, { status: 500 });
  }
}
