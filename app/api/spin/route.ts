import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { balancesResponse, getUserBalances, settleSpin, totalBalance } from "@/lib/balances";
import { recordBigWinIfEligible, XBOOT_GAME_ID, XBOOT_GAME_TITLE, inferScatterBuyFromSeed } from "@/lib/big-wins";
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
  const effectiveBet = Number(body?.effectiveBet ?? bet);

  if (!Number.isFinite(bet) || bet < 0) {
    return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
  }

  if (!Number.isFinite(win) || win < 0) {
    return NextResponse.json({ error: "Invalid win" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (bet === 0 && win === 0) {
        const balances = await getUserBalances(tx, userId);
        return { balances, total: totalBalance(balances) };
      }
      const settled = await settleSpin(tx, userId, bet, win);
      if (bet > 0) {
        await addWagerProgress(tx, userId, bet);
      }
      return settled;
    });

    if (win > 0) {
      try {
        await recordBigWinIfEligible(prisma, userId, {
          bet,
          win,
          effectiveBet,
          game: String(body?.game || XBOOT_GAME_ID),
          gameTitle: String(body?.gameTitle || XBOOT_GAME_TITLE),
          bookSeed: body?.bookSeed ?? null,
          bookIndex: body?.bookIndex ?? null,
          scatterBuy:
            Number(body?.scatterBuy) === 3 || Number(body?.scatterBuy) === 4
              ? Number(body.scatterBuy)
              : inferScatterBuyFromSeed(body?.bookSeed),
        });
      } catch (err) {
        console.error("[recordBigWinIfEligible error]", err);
        /* leaderboard is best-effort; never block spin settlement */
      }
    }

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

    return NextResponse.json({ error: "Недостаточно средств" }, { status: 400 });
  }
}
