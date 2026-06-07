import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import {
  fetchGlobalLeaderboard,
  fetchPersonalLeaderboard,
  XBOOT_GAME_ID,
} from "@/lib/big-wins";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "personal" ? "personal" : "global";
  const gameParam = url.searchParams.get("game");
  const game =
    gameParam === "all" || gameParam === ""
      ? null
      : (gameParam || XBOOT_GAME_ID).trim() || XBOOT_GAME_ID;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));

  if (scope === "personal") {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({
        scope,
        game,
        loggedIn: false,
        entries: [],
      });
    }

    const entries = await fetchPersonalLeaderboard(userId, game, limit);
    return NextResponse.json({
      scope,
      game,
      loggedIn: true,
      entries,
    });
  }

  const entries = await fetchGlobalLeaderboard(game, limit);
  return NextResponse.json({
    scope,
    game,
    loggedIn: !!(await getUserIdFromCookie()),
    entries,
  });
}
