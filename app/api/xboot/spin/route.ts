import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { balancesResponse, settleSpin } from "@/lib/balances";
import { addWagerProgress } from "@/lib/promo";
import { prisma } from "@/lib/prisma";
import {
  calculateWaysWin,
  generateSpinOutcome,
  REEL_ROWS,
  NUM_REELS
} from "@/lib/xboot-math";

/**
 * Серверный спин Red Devil: RNG и resolve на сервере (аналог книг Rave).
 * POST { bet: number } → исход + баланс после bet/win за один запрос.
 */
export async function POST(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const bet = Number(body?.bet ?? 0);
  if (!(bet > 0)) {
    return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
  }

  const outcome = generateSpinOutcome();
  const { totalWin, wins } = calculateWaysWin(
    bet,
    outcome.board,
    outcome.mults,
    outcome.reelNudgeMult
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settled = await settleSpin(tx, userId, bet, totalWin);
      await addWagerProgress(tx, userId, bet);
      return settled;
    });

    return NextResponse.json({
      reelRows: REEL_ROWS,
      numReels: NUM_REELS,
      board: outcome.board,
      mults: outcome.mults,
      win: totalWin,
      wins,
      scatters: outcome.scatters,
      xWaysReplacement: outcome.xWays.replacement,
      ...balancesResponse(result.balances)
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ error: "Недостаточно средств" }, { status: 400 });
    }
    console.error("[xboot/spin]", err);
    return NextResponse.json({ error: "Spin failed" }, { status: 500 });
  }
}
