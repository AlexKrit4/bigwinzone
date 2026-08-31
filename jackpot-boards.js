'use strict';

/**
 * Детерминированные максвин-книги Das xBoot (55 200× @ bet=1).
 * Выплаты по спинам заданы явно (rec.win) — клиент использует их в джекпот-сессии.
 * - base / buy4: 7 FS, торпеда 4 части каждый спин, нарастающий выигрыш, максвин на 7-м
 * - buy3: 4 обычных спина, затем 5–7 с target + nudge ×4 и капитанами
 */

const {
  SYMBOLS,
  BASE_REEL_ROWS,
  NUM_REELS,
  makeSimCtx,
  createRng,
  simulateBaseSpinOutcome,
  buildBoardWithScatterCount,
  makeSpinSeed,
  winMultiplier
} = require('./xboot-slot-sim.js');

const MAX_WIN_AT_BET1 = 55200;
const BONUS_SPINS = 7;
const BONUS_EXPAND_REEL = 2;
const BONUS3_ROWS = BASE_REEL_ROWS.map((h, i) => (i === BONUS_EXPAND_REEL ? 8 : h));

const IX = {
  high1: SYMBOLS.indexOf('high1'),
  high2: SYMBOLS.indexOf('high2'),
  wild: SYMBOLS.indexOf('wild'),
  target: SYMBOLS.indexOf('target'),
  wild4: SYMBOLS.indexOf('wild4'),
  xways4: SYMBOLS.indexOf('xways4'),
  xwild4: SYMBOLS.indexOf('xwild4'),
  low1: SYMBOLS.indexOf('low1')
};

const TORPEDO_BUILDERS = [
  { reel: 1, row: 1, sym: IX.xways4 },
  { reel: 2, row: 0, sym: IX.xwild4 },
  { reel: 3, row: 0, sym: IX.xwild4 },
  { reel: 4, row: 1, sym: IX.xways4 }
];

/** Нарастающие выплаты bonus4 — сумма ровно 55 200. */
const BONUS4_JACKPOT_WINS = [88, 176, 440, 880, 2200, 8800, 42616];

/** buy3: 4 спокойных спина, затем разгон на 5–7. */
const BUY3_JACKPOT_WINS = [0, 0, 0, 0, 4400, 13200, 37600];

function onesGrid(rows = BASE_REEL_ROWS) {
  return rows.map((n) => Array.from({ length: n }, () => 1));
}

function captainGrid(rows = BASE_REEL_ROWS) {
  return rows.map((n) => Array.from({ length: n }, () => IX.high1));
}

function makeRecord(reelIndices, weights, nudge, extra = {}) {
  return {
    seed: '',
    reelIndices,
    weights: weights || onesGrid(reelIndices.map((col) => col.length)),
    reelNudgeMult: nudge || Array(reelIndices.length).fill(1),
    win: 0,
    ...extra
  };
}

function torpedoDropsFromGrid(g) {
  return TORPEDO_BUILDERS.map((spec, slot) => ({
    slot,
    reel: spec.reel,
    row: spec.row,
    sym: SYMBOLS[g[spec.reel][spec.row]]
  }));
}

function torpedoResolvedCaptains(mult = 1) {
  return Array.from({ length: 4 }, () => ({ symIx: IX.high1, mult }));
}

function buildTorpedoVisualBoard({
  matchReels = 4,
  resolveTorpedo = false,
  nudge = [1, 1, 1, 1, 1, 1],
  finalScreen = false
} = {}) {
  if (finalScreen) {
    const g = captainGrid();
    for (const spec of TORPEDO_BUILDERS) g[spec.reel][spec.row] = spec.sym;
    for (let row = 0; row < BASE_REEL_ROWS[2]; row++) g[2][row] = IX.wild;
    for (let row = 0; row < BASE_REEL_ROWS[3]; row++) g[3][row] = IX.wild;
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
        if (r !== 2 && r !== 3) g[r][row] = IX.wild4;
      }
    }
    return {
      g,
      nudge: [1, 1, 4, 4, 1, 1],
      drops: torpedoDropsFromGrid(g),
      torpedoComplete: false,
      torpedoResolved: undefined
    };
  }

  const g = BASE_REEL_ROWS.map((n, r) =>
    Array.from({ length: n }, () => (r < matchReels ? IX.high1 : IX.low1))
  );
  for (const spec of TORPEDO_BUILDERS) g[spec.reel][spec.row] = spec.sym;

  return {
    g,
    nudge: nudge.slice(),
    drops: torpedoDropsFromGrid(g),
    torpedoComplete: !!resolveTorpedo,
    torpedoResolved: resolveTorpedo ? torpedoResolvedCaptains(1) : undefined
  };
}

function makeTorpedoJackpotSpin(winAt1, spec) {
  const { g, nudge, drops, torpedoComplete, torpedoResolved } = buildTorpedoVisualBoard(spec);
  const rec = makeRecord(g, onesGrid(), nudge, {
    torpedoDrops: drops,
    torpedoComplete,
    torpedoResolved
  });
  rec.win = winAt1;
  return rec;
}

/** 7 фри-спинов bonus4: торпеда каждый спин, выплаты растут, финал на 7-м. */
function buildJackpotBonusSpinRecords() {
  const specs = [
    { matchReels: 3, resolveTorpedo: false, nudge: [1, 1, 1, 1, 1, 1] },
    { matchReels: 3, resolveTorpedo: true, nudge: [1, 1, 1, 1, 1, 1] },
    { matchReels: 4, resolveTorpedo: false, nudge: [1, 1, 1, 1, 1, 1] },
    { matchReels: 4, resolveTorpedo: true, nudge: [1, 1, 1, 2, 1, 1] },
    { matchReels: 5, resolveTorpedo: false, nudge: [1, 1, 1, 1, 1, 1] },
    { matchReels: 5, resolveTorpedo: true, nudge: [1, 1, 1, 2, 1, 1] },
    { finalScreen: true }
  ];
  return specs.map((spec, i) => makeTorpedoJackpotSpin(BONUS4_JACKPOT_WINS[i], spec));
}

function makeBuy3NormalSpin() {
  const g = BONUS3_ROWS.map((n, r) =>
    Array.from({ length: n }, (_, row) => {
      if (r === 0 && row === 0) return IX.low1;
      return IX.high2;
    })
  );
  const rec = makeRecord(g, onesGrid(BONUS3_ROWS), [1, 1, 1, 1, 1, 1]);
  rec.win = 0;
  return rec;
}

function makeBuy3BigSpin(winAt1) {
  const g = captainGrid(BONUS3_ROWS);
  g[0][0] = IX.low1;
  g[BONUS_EXPAND_REEL][0] = IX.target;
  for (let row = 1; row < BONUS3_ROWS[BONUS_EXPAND_REEL]; row++) {
    g[BONUS_EXPAND_REEL][row] = IX.high1;
  }
  const rec = makeRecord(g, onesGrid(BONUS3_ROWS), [1, 1, 1, 4, 1, 1]);
  rec.win = winAt1;
  return rec;
}

function buildBuy3MaxWinBonusSpins() {
  const spins = [];
  for (let i = 0; i < 4; i++) spins.push(makeBuy3NormalSpin());
  for (let i = 4; i < 7; i++) spins.push(makeBuy3BigSpin(BUY3_JACKPOT_WINS[i]));
  return spins;
}

function capBookTotals(book) {
  let bonusWin = book.bonusSpins.reduce((s, sp) => s + (Number(sp.win) || 0), 0);
  const baseWin = Number(book.spin.win) || 0;
  let totalWin = baseWin + bonusWin;
  if (Math.abs(totalWin - MAX_WIN_AT_BET1) > 0.01) {
    console.warn(`[JACKPOT] book ${book.id} total=${totalWin} expected ${MAX_WIN_AT_BET1}`);
  }
  book.bonusWin = bonusWin;
  book.totalWin = totalWin;
  book.totalWinMultiplier = winMultiplier(totalWin, 1);
  return book;
}

function buildSyntheticMaxWinBook(bookId, config = {}) {
  const seedIdPrefix = config.seedIdPrefix || 'xb';
  const scatterCount = config.scatterCount === 3 ? 3 : 4;
  const rng = createRng((bookId * 99991) >>> 0);
  const landing = buildBoardWithScatterCount(scatterCount, rng);
  const ctx = makeSimCtx(rng);
  const outcome = simulateBaseSpinOutcome(landing, ctx);

  const bonusSpins =
    scatterCount === 3 ? buildBuy3MaxWinBonusSpins() : buildJackpotBonusSpinRecords();

  for (let i = 0; i < bonusSpins.length; i++) {
    const rows = scatterCount === 3 ? BONUS3_ROWS : BASE_REEL_ROWS;
    bonusSpins[i].seed = makeSpinSeed(
      bookId,
      i + 1,
      bonusSpins[i].reelIndices,
      bonusSpins[i].weights,
      seedIdPrefix
    );
    for (let r = 0; r < NUM_REELS; r++) bonusSpins[i][`reel${r}`] = bonusSpins[i].reelIndices[r];
  }

  const baseSpinSeed = makeSpinSeed(
    bookId,
    0,
    outcome.board.map((c) => c.map((s) => SYMBOLS.indexOf(s))),
    outcome.mults,
    seedIdPrefix
  );

  const book = capBookTotals({
    id: bookId,
    seed: baseSpinSeed,
    hasBonus: true,
    scatterCount,
    isJackpot: true,
    spin: {
      seed: baseSpinSeed,
      win: outcome.win,
      winMultiplier: winMultiplier(outcome.win, 1),
      reelIndices: outcome.board.map((c) => c.map((s) => SYMBOLS.indexOf(s))),
      weights: outcome.mults.map((c) => [...c]),
      reelNudgeMult: outcome.reelNudgeMult.slice()
    },
    bonusSpins,
    bonusWin: 0,
    totalWin: 0
  });

  return book;
}

function buildBuy3MaxWinBook(bookId, config = {}) {
  return buildSyntheticMaxWinBook(bookId, { ...config, seedIdPrefix: config.seedIdPrefix || 'xbb3', scatterCount: 3 });
}

function buildBuy4MaxWinBook(bookId, config = {}) {
  return buildSyntheticMaxWinBook(bookId, { ...config, seedIdPrefix: config.seedIdPrefix || 'xbb4', scatterCount: 4 });
}

// Legacy export used by tests / calculateWaysWinAtBet1 in old code paths
function calculateWaysWinAtBet1(board, mults, reelNudgeMult, torpedoResolved = null, rows = BASE_REEL_ROWS) {
  const PAYABLE = ['high1', 'high2', 'high3', 'high4', 'high5', 'low1', 'low2', 'low3', 'low4', 'low5'];
  const PAYOUTS = {
    high1: { 3: 0.88, 4: 3, 5: 6, 6: 20 },
    high2: { 3: 0.4, 4: 0.6, 5: 3.2, 6: 10 },
    high3: { 3: 0.32, 4: 0.52, 5: 1.6, 6: 4.8 },
    high4: { 3: 0.28, 4: 0.48, 5: 1.2, 6: 4 },
    high5: { 3: 0.28, 4: 0.4, 5: 0.88, 6: 3.2 },
    low1: { 3: 0.24, 4: 0.36, 5: 0.8, 6: 2.8 },
    low2: { 3: 0.24, 4: 0.36, 5: 0.72, 6: 2.8 },
    low3: { 3: 0.2, 4: 0.32, 5: 0.68, 6: 2 },
    low4: { 3: 0.2, 4: 0.28, 5: 0.6, 6: 2 },
    low5: { 3: 0.2, 4: 0.24, 5: 0.52, 6: 1.4 }
  };
  const cellMatches = (sym, cell) =>
    cell === sym || cell === 'wild' || cell === 'wild4' || cell === 'xways4' || cell === 'xwild4';
  const torpedoReels = [1, 2, 3, 4];
  function countOnReel(sym, r) {
    let count = 0;
    for (let row = 0; row < rows[r]; row++) {
      const name = SYMBOLS[board[r][row]];
      if (cellMatches(sym, name)) count += mults[r][row] || 1;
    }
    if (torpedoResolved) {
      const slot = torpedoReels.indexOf(r);
      if (slot >= 0) {
        const t = torpedoResolved[slot];
        if (t && cellMatches(sym, SYMBOLS[t.symIx] ?? t.sym)) count += t.mult || 1;
      }
    }
    return count;
  }
  let totalWin = 0;
  for (const sym of PAYABLE) {
    let reelsMatched = 0;
    let ways = 1;
    let nudgeLineMult = 1;
    for (let r = 0; r < NUM_REELS; r++) {
      const c = countOnReel(sym, r);
      if (c === 0) break;
      reelsMatched++;
      ways *= c;
      nudgeLineMult *= reelNudgeMult[r] || 1;
    }
    if (reelsMatched < 3) continue;
    const payMult = PAYOUTS[sym][reelsMatched] ?? PAYOUTS[sym][6] ?? 0;
    totalWin += payMult * ways * nudgeLineMult;
  }
  return totalWin;
}

function makeTorpedoCollectSpin(opts = {}) {
  const spec = opts.finalScreen
    ? { finalScreen: true }
    : { matchReels: opts.big ? 6 : 4, resolveTorpedo: !opts.finalScreen, nudge: [1, 1, 1, 1, 1, 1] };
  return makeTorpedoJackpotSpin(0, spec);
}

module.exports = {
  MAX_WIN_AT_BET1,
  BONUS_SPINS,
  BONUS3_ROWS,
  BONUS4_JACKPOT_WINS,
  BUY3_JACKPOT_WINS,
  buildJackpotBonusSpinRecords,
  buildBuy3MaxWinBonusSpins,
  buildSyntheticMaxWinBook,
  buildBuy3MaxWinBook,
  buildBuy4MaxWinBook,
  calculateWaysWinAtBet1,
  makeTorpedoCollectSpin
};
