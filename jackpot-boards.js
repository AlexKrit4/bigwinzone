'use strict';

/**
 * Детерминированные максвин-книги Das xBoot (55 200× @ bet=1).
 * - base / buy4: бонус 4 scatter, торпеда 4 части каждый спин, капитаны (high1)
 * - buy3: бонус 3 scatter, максвин на 5–7 спинах (target + nudge ×4)
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
  wild: SYMBOLS.indexOf('wild'),
  target: SYMBOLS.indexOf('target'),
  wild4: SYMBOLS.indexOf('wild4'),
  xways4: SYMBOLS.indexOf('xways4'),
  xwild4: SYMBOLS.indexOf('xwild4')
};

const TORPEDO_BUILDERS = [
  { reel: 1, row: 1, sym: IX.xways4 },
  { reel: 2, row: 0, sym: IX.xwild4 },
  { reel: 3, row: 0, sym: IX.xwild4 },
  { reel: 4, row: 1, sym: IX.xways4 }
];

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

function torpedoResolvedCaptains() {
  return [
    { symIx: IX.high1, mult: 2 },
    { symIx: IX.high1, mult: 2 },
    { symIx: IX.high1, mult: 2 },
    { symIx: IX.high1, mult: 2 }
  ];
}

/** Каждый спин: 4 части торпеды, остальное — капитаны. */
function makeTorpedoCollectSpin({ big = false, finalScreen = false } = {}) {
  const g = captainGrid();
  const drops = [];
  for (const spec of TORPEDO_BUILDERS) {
    g[spec.reel][spec.row] = spec.sym;
    drops.push({ slot: TORPEDO_BUILDERS.findIndex((s) => s.reel === spec.reel), reel: spec.reel, row: spec.row, sym: SYMBOLS[spec.sym] });
  }

  let nudge = [1, 1, 1, 1, 1, 1];
  if (finalScreen) {
    for (let row = 0; row < BASE_REEL_ROWS[2]; row++) g[2][row] = IX.wild;
    for (let row = 0; row < BASE_REEL_ROWS[3]; row++) g[3][row] = IX.wild;
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
        g[r][row] = r === 2 || r === 3 ? g[r][row] : IX.wild4;
      }
    }
    nudge = [1, 1, 4, 4, 1, 1];
  } else if (big) {
    for (let r = 1; r <= 4; r++) {
      for (let row = 0; row < BASE_REEL_ROWS[r]; row++) g[r][row] = IX.wild4;
    }
  }

  const torpedoResolved = finalScreen ? null : torpedoResolvedCaptains();
  const w = calculateWaysWinAtBet1(g, onesGrid(), nudge, torpedoResolved);
  const rec = makeRecord(g, onesGrid(), nudge, {
    torpedoDrops: drops,
    torpedoComplete: !finalScreen,
    torpedoResolved: torpedoResolved || undefined
  });
  rec.win = w;
  return rec;
}

/** 7 фри-спинов bonus4: каждый спин собирает торпеду из 4 частей; финал — полный экран. */
function buildJackpotBonusSpinRecords() {
  const spins = [];
  for (let i = 0; i < 5; i++) spins.push(makeTorpedoCollectSpin({ big: i >= 3 }));
  spins.push(makeTorpedoCollectSpin({ big: true }));
  spins.push(makeTorpedoCollectSpin({ finalScreen: true }));
  return spins;
}

function captainBonus3Grid() {
  return captainGrid(BONUS3_ROWS);
}

function buildBuy3MaxWinBonusSpins() {
  const spins = [];
  for (let i = 0; i < 4; i++) {
    const g = captainBonus3Grid();
    g[0][0] = SYMBOLS.indexOf('low1');
    spins.push(makeRecord(g, onesGrid(BONUS3_ROWS), [1, 1, 1, 1, 1, 1]));
  }

  const makeBigSpin = () => {
    const g = captainBonus3Grid();
    g[0][0] = SYMBOLS.indexOf('low1');
    g[BONUS_EXPAND_REEL][0] = IX.target;
    for (let row = 1; row < BONUS3_ROWS[BONUS_EXPAND_REEL]; row++) g[BONUS_EXPAND_REEL][row] = IX.high1;
    const nudge = [1, 1, 1, 4, 1, 1];
    const w = calculateWaysWinAtBet1(g, onesGrid(BONUS3_ROWS), nudge, null, BONUS3_ROWS);
    const rec = makeRecord(g, onesGrid(BONUS3_ROWS), nudge);
    rec.win = w;
    return rec;
  };

  spins.push(makeBigSpin());
  spins.push(makeBigSpin());
  spins.push(makeBigSpin());
  return spins;
}

function capBookTotals(book) {
  let bonusWin = book.bonusSpins.reduce((s, sp) => s + (Number(sp.win) || 0), 0);
  const baseWin = Number(book.spin.win) || 0;
  let totalWin = baseWin + bonusWin;
  if (totalWin > MAX_WIN_AT_BET1) {
    totalWin = MAX_WIN_AT_BET1;
    bonusWin = Math.max(0, totalWin - baseWin);
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
    bonusSpins[i].seed = makeSpinSeed(bookId, i + 1, bonusSpins[i].reelIndices, bonusSpins[i].weights, seedIdPrefix);
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

module.exports = {
  MAX_WIN_AT_BET1,
  BONUS_SPINS,
  BONUS3_ROWS,
  buildJackpotBonusSpinRecords,
  buildBuy3MaxWinBonusSpins,
  buildSyntheticMaxWinBook,
  buildBuy3MaxWinBook,
  buildBuy4MaxWinBook,
  calculateWaysWinAtBet1,
  makeTorpedoCollectSpin
};
