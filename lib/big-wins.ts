import { PrismaClient, Prisma } from "@prisma/client";
import { roundMoney } from "@/lib/balances";

export const BIG_WIN_PRESENTATION_MULT = 15;
export const XBOOT_GAME_ID = "xboot";
export const XBOOT_GAME_TITLE = "Red Devil";
export const NEWSLOT_GAME_ID = "newslot";
export const NEWSLOT_GAME_TITLE = "New Slot";

export type BigWinEntry = {
  id: string;
  rank: number;
  date: string;
  game: string;
  gameTitle: string;
  multiplier: number;
  win: number;
  bet: number;
  bookSeed: string | null;
  bookIndex: number | null;
  scatterBuy: number;
  username?: string;
};

export function inferScatterBuyFromSeed(seed: string | null | undefined) {
  const s = String(seed || "").trim().toLowerCase();
  if (s.startsWith("xbb3_")) return 3;
  if (s.startsWith("xbb4_")) return 4;
  return 0;
}

function formatLeaderboardDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function recordBigWinIfEligible(
  dbClient: PrismaClient | Prisma.TransactionClient,
  userId: string,
  opts: {
    bet: number;
    win: number;
    effectiveBet?: number;
    game?: string;
    gameTitle?: string;
    bookSeed?: string | null;
    bookIndex?: number | null;
    scatterBuy?: number;
  },
) {
  const win = roundMoney(Math.max(0, opts.win));
  const effectiveBet = roundMoney(Math.max(0, opts.effectiveBet ?? opts.bet));
  console.log("[recordBigWinIfEligible] win:", win, "effectiveBet:", effectiveBet, "opts:", opts);
  if (win <= 0 || effectiveBet <= 0) return null;

  const multiplier = roundMoney(win / effectiveBet);

  const scatterBuy =
    opts.scatterBuy === 3 || opts.scatterBuy === 4
      ? opts.scatterBuy
      : inferScatterBuyFromSeed(opts.bookSeed);

  return dbClient.bigWin.create({
    data: {
      userId,
      game: opts.game || XBOOT_GAME_ID,
      gameTitle: opts.gameTitle || XBOOT_GAME_TITLE,
      bet: effectiveBet,
      win,
      multiplier,
      bookSeed: opts.bookSeed?.trim() || null,
      bookIndex:
        opts.bookIndex != null && Number.isFinite(Number(opts.bookIndex))
          ? Math.trunc(Number(opts.bookIndex))
          : null,
      scatterBuy,
    },
  });
}

export async function fetchGlobalLeaderboard(
  game: string | null,
  limit = 10,
): Promise<BigWinEntry[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.bigWin.findMany({
    where: game ? { game } : undefined,
    orderBy: [{ multiplier: "desc" }, { win: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      user: { select: { username: true } },
    },
  });

  return rows.map((row, i) => ({
    id: row.id,
    rank: i + 1,
    date: formatLeaderboardDate(row.createdAt),
    game: row.game,
    gameTitle: row.gameTitle,
    multiplier: row.multiplier,
    win: row.win,
    bet: row.bet,
    bookSeed: row.bookSeed,
    bookIndex: row.bookIndex,
    scatterBuy: row.scatterBuy,
    username: row.user.username,
  }));
}

export async function fetchPersonalLeaderboard(
  userId: string,
  game: string | null,
  limit = 10,
): Promise<BigWinEntry[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.bigWin.findMany({
    where: {
      userId,
      ...(game ? { game } : {}),
    },
    orderBy: [{ multiplier: "desc" }, { win: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return rows.map((row, i) => ({
    id: row.id,
    rank: i + 1,
    date: formatLeaderboardDate(row.createdAt),
    game: row.game,
    gameTitle: row.gameTitle,
    multiplier: row.multiplier,
    win: row.win,
    bet: row.bet,
    bookSeed: row.bookSeed,
    bookIndex: row.bookIndex,
    scatterBuy: row.scatterBuy,
  }));
}
