'use strict';

/**
 * Детерминированные доски джекпот-книги (bonus4): торпеда по 1 символу/спин → максвин на 7-м.
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

const IX = {
  high1: SYMBOLS.indexOf('high1'),
  wild: SYMBOLS.indexOf('wild'),
  wild4: SYMBOLS.indexOf('wild4'),
  xways4: SYMBOLS.indexOf('xways4'),
  xwild4: SYMBOLS.indexOf('xwild4')
};

function onesGrid() {
  return BASE_REEL_ROWS.map((n) => Array.from({ length: n }, () => 1));
}

function highGrid() {
  return BASE_REEL_ROWS.map((n) => Array.from({ length: n }, () => IX.high1));
}

function makeRecord(reelIndices, weights, nudge, seedLabel = '') {
  return {
    seed: seedLabel,
    reelIndices,
    weights: weights || onesGrid(),
    reelNudgeMult: nudge || [1, 1, 1, 1, 1, 1],
    win: 0
  };
}

/** Расчёт ways как в slot.js (с торпедой после resolve). */
function calculateWaysWinAtBet1(board, mults, reelNudgeMult, torpedoResolved = null) {
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
    cell === sym ||
    cell === 'wild' ||
    cell === 'wild4' ||
    cell === 'xways4' ||
    cell === 'xwild4';

  const torpedoReels = [1, 2, 3, 4];

  function countOnReel(sym, r) {
    let count = 0;
    for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
      const name = SYMBOLS[board[r][row]];
      if (cellMatches(sym, name)) count += mults[r][row] || 1;
    }
    if (torpedoResolved) {
      const slot = torpedoReels.indexOf(r);
      if (slot >= 0) {
        const t = torpedoResolved[slot];
        if (t && cellMatches(sym, SYMBOLS[t.symIx] || t.sym)) count += t.mult || 1;
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

function boardFromIndices(ix) {
  return ix.map((col) => col.map((i) => SYMBOLS[i] || 'low1'));
}

/** 7 фри-спинов: 1–4 торпеда, 5–6 прогрев, 7 — максвин (nudge ×4 на барабанах 3–4). */
function buildJackpotBonusSpinRecords() {
  const spins = [];

  const lowIx = SYMBOLS.indexOf('low1');

  // Спины 1–4: по одному билдеру торпеды, без длинных линий (reel0 ломает 6OAK)
  for (const spec of [
    { reel: 1, row: 1, sym: IX.xways4 },
    { reel: 2, row: 0, sym: IX.xwild4 },
    { reel: 3, row: 0, sym: IX.xwild4 },
    { reel: 4, row: 1, sym: IX.xways4 }
  ]) {
    const g = highGrid();
    g[0][0] = lowIx;
    g[spec.reel][spec.row] = spec.sym;
    spins.push(makeRecord(g, onesGrid(), [1, 1, 1, 1, 1, 1]));
  }

  // Спин 5: торпеда полная (wild4), умеренный выигрыш
  {
    const g = highGrid();
    g[0][0] = lowIx;
    g[1][1] = IX.wild4;
    g[2][0] = IX.wild4;
    g[3][0] = IX.wild4;
    g[4][1] = IX.wild4;
    const torp = [
      { symIx: IX.high1, mult: 2 },
      { symIx: IX.high1, mult: 2 },
      { symIx: IX.high1, mult: 2 },
      { symIx: IX.high1, mult: 2 }
    ];
    const w = calculateWaysWinAtBet1(g, onesGrid(), [1, 1, 1, 1, 1, 1], torp);
    spins.push(makeRecord(g, onesGrid(), [1, 1, 1, 1, 1, 1]));
    spins[spins.length - 1].win = w;
  }

  // Спин 6: торпеда на поле (wild4), без nudge ×4 — прогрев перед финалом
  {
    const g = highGrid();
    g[0][0] = lowIx;
    g[1][1] = IX.wild4;
    g[2][0] = IX.wild4;
    g[3][0] = IX.wild4;
    g[4][1] = IX.wild4;
    const w = calculateWaysWinAtBet1(g, onesGrid(), [1, 1, 1, 1, 1, 1], null);
    spins.push(makeRecord(g, onesGrid(), [1, 1, 1, 1, 1, 1]));
    spins[spins.length - 1].win = w;
  }

  // Спин 7: полный экран wild/wild4, nudge ×4 на барабанах 3–4
  {
    const g = BASE_REEL_ROWS.map((n) => Array.from({ length: n }, () => IX.wild4));
    for (let row = 0; row < BASE_REEL_ROWS[2]; row++) g[2][row] = IX.wild;
    for (let row = 0; row < BASE_REEL_ROWS[3]; row++) g[3][row] = IX.wild;
    const nudge = [1, 1, 4, 4, 1, 1];
    const w = calculateWaysWinAtBet1(g, onesGrid(), nudge, null);
    spins.push(makeRecord(g, onesGrid(), nudge));
    spins[spins.length - 1].win = w;
  }

  return spins;
}

function buildSyntheticMaxWinBook(bookId, config) {
  const seedIdPrefix = config.seedIdPrefix || 'xb';
  const rng = createRng((bookId * 99991) >>> 0);
  const landing = buildBoardWithScatterCount(4, rng);
  const ctx = makeSimCtx(rng);
  const outcome = simulateBaseSpinOutcome(landing, ctx);

  const bonusSpins = buildJackpotBonusSpinRecords();
  for (let i = 0; i < bonusSpins.length; i++) {
    bonusSpins[i].seed = makeSpinSeed(bookId, i + 1, bonusSpins[i].reelIndices, bonusSpins[i].weights, seedIdPrefix);
  }

  let bonusWin = bonusSpins.reduce((s, sp) => s + (Number(sp.win) || 0), 0);
  const baseWin = outcome.win;
  let totalWin = baseWin + bonusWin;

  const cap = MAX_WIN_AT_BET1;
  if (totalWin > cap) totalWin = cap;
  if (baseWin + bonusWin > cap) {
    bonusWin = Math.max(0, cap - baseWin);
  }

  const baseSpinSeed = makeSpinSeed(bookId, 0, outcome.board.map((c) => c.map((s) => SYMBOLS.indexOf(s))), outcome.mults, seedIdPrefix);

  const spin = {
    seed: baseSpinSeed,
    win: baseWin,
    winMultiplier: winMultiplier(baseWin, 1),
    reelIndices: outcome.board.map((c) => c.map((s) => SYMBOLS.indexOf(s))),
    weights: outcome.mults.map((c) => [...c]),
    reelNudgeMult: outcome.reelNudgeMult.slice()
  };

  const lastWin = calculateWaysWinAtBet1(
    bonusSpins[6].reelIndices,
    bonusSpins[6].weights,
    bonusSpins[6].reelNudgeMult
  );

  return {
    id: bookId,
    seed: baseSpinSeed,
    hasBonus: true,
    scatterCount: 4,
    isJackpot: true,
    spin,
    bonusSpins,
    bonusWin,
    totalWin,
    totalWinMultiplier: winMultiplier(totalWin, 1),
    maxSpinCalcWin: lastWin
  };
}

module.exports = {
  MAX_WIN_AT_BET1,
  BONUS_SPINS,
  buildJackpotBonusSpinRecords,
  buildSyntheticMaxWinBook,
  calculateWaysWinAtBet1,
  boardFromIndices
};
