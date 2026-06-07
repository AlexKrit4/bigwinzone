'use strict';

/**
 * Headless-симуляция Das xBoot (как games/xboot/slot.js), без DOM.
 * Используется generate-xboot-books.js для расчёта total_win@1.
 */

const BASE_REEL_ROWS = [2, 3, 4, 4, 3, 2];
const NUM_REELS = 6;
const BONUS_EXPAND_REEL = 2;
const BONUS_EXPAND_ROWS = 8;

const SYMBOLS = [
  'low1', 'low2', 'low3', 'low4', 'low5',
  'high1', 'high2', 'high3', 'high4', 'high5',
  'scatter', 'xWays', 'xNudge', 'wild', 'target',
  'wild4', 'xways4', 'xwild4'
];

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

const PAYABLE = Object.keys(PAYOUTS);

const XWAYS_REELS = [1, 4];
const XNUDGE_REELS = [2, 3];
const BONUS3_XNUDGE_REELS = [3];
const BONUS3_XWAYS_REELS = [1, 4];
const BONUS4_TORPEDO_REELS = [1, 2, 3, 4];
const BONUS4_XWAYS4_REELS = [1, 4];
const BONUS4_XWILD4_REELS = [2, 3];

const XWAYS_REDUCTION = 12;
const XNUDGE_STACK_SIZE = 4;
const XNUDGE_LAND_CHANCE = 0.14;
const SCATTER_WEIGHT = 0.22;
const SCATTER_REELS = [1, 2, 3, 4];
const SCATTER_REEL_LAND_CHANCE = 0.11;
const TARGET_LAND_CHANCE = 0.4;
const BONUS4_BUILDER_LAND_CHANCE = 0.3;
const BONUS_SPINS_FOR_3 = 7;
const BONUS_SPINS_FOR_4 = 7;

function createRng(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return {
    random() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    randomInt(min, max) {
      const lo = Math.ceil(Number(min) || 0);
      const hi = Math.floor(Number(max) || 0);
      if (hi <= lo) return lo;
      return lo + Math.floor(this.random() * (hi - lo + 1));
    }
  };
}

function cloneGrid(grid) {
  return grid.map((col) => [...col]);
}

function getXNudgeVisibleCount(symbols) {
  if (!symbols?.length) return 0;
  let n = 0;
  for (let row = 0; row < symbols.length; row++) {
    if (symbols[row] !== 'xNudge') break;
    n++;
  }
  return n;
}

function cellMatches(sym, cell) {
  return (
    cell === sym ||
    cell === 'wild' ||
    cell === 'wild4' ||
    cell === 'xways4' ||
    cell === 'xwild4'
  );
}

function makeSimCtx(rng, opts = {}) {
  const bonusMode = !!opts.bonusMode;
  const bonusEntryScatterCount = Number(opts.bonusEntryScatterCount) || 0;
  const bonusReelExpanded = !!opts.bonusReelExpanded;
  const activeReelRows = opts.activeReelRows || BASE_REEL_ROWS;

  const isBonus4 = bonusMode && bonusEntryScatterCount >= 4;
  const isBonus3 = bonusMode && bonusEntryScatterCount === 3;

  function getReelRows(reel) {
    return activeReelRows[reel];
  }

  function getActiveXNudgeReels() {
    if (isBonus4) return [];
    if (isBonus3) return BONUS3_XNUDGE_REELS;
    if (bonusMode) return [];
    return XNUDGE_REELS;
  }

  function getActiveXWAYSReels() {
    if (isBonus4) return XWAYS_REELS;
    if (isBonus3) return BONUS3_XWAYS_REELS;
    if (bonusMode) return [];
    return XWAYS_REELS;
  }

  function getXNudgeStackSize(reel = -1) {
    if (opts.bonusTargetNudgeArtReel && bonusMode && reel === BONUS_EXPAND_REEL) {
      return BONUS_EXPAND_ROWS;
    }
    return XNUDGE_STACK_SIZE;
  }

  function getSymbolWeight(name, reelIndex = -1, pickOpts = {}) {
    const bonus = !!pickOpts.bonus;
    const omitScatter = !!pickOpts.omitScatter;
    if (name === 'xWays') {
      const xwReels = bonus ? getActiveXWAYSReels() : XWAYS_REELS;
      if (!xwReels.length) return 0;
      return reelIndex >= 0 && xwReels.includes(reelIndex) ? 1 / XWAYS_REDUCTION : 0;
    }
    if (name === 'xNudge' || name === 'wild') return 0;
    if (name === 'target') {
      if (isBonus4) return 0;
      if (bonus && reelIndex === BONUS_EXPAND_REEL && pickOpts.spinStrip) {
        return (TARGET_LAND_CHANCE / (1 - TARGET_LAND_CHANCE)) * PAYABLE.length;
      }
      return 0;
    }
    if (name === 'scatter') {
      if (bonus || omitScatter) return 0;
      return reelIndex >= 0 && SCATTER_REELS.includes(reelIndex) ? SCATTER_WEIGHT : 0;
    }
    return 1;
  }

  function pickRandomSymbol(reelIndex = -1, pickOpts = {}) {
    const weights = SYMBOLS.slice(0, 15).map((name) => getSymbolWeight(name, reelIndex, pickOpts));
    const total = weights.reduce((a, b) => a + b, 0);
    if (!(total > 0)) return 'low1';
    let r = rng.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return SYMBOLS[i];
    }
    return SYMBOLS[0];
  }

  function placeAtMostOneBonusTarget(col, rows) {
    for (let row = 0; row < rows; row++) {
      if (col[row] === 'target') {
        col[row] = pickRandomSymbol(BONUS_EXPAND_REEL, { bonus: true, omitScatter: true });
      }
    }
    if (rng.random() >= TARGET_LAND_CHANCE) return;
    let targetRow = rng.randomInt(0, rows - 1);
    if (col[targetRow] === 'scatter') targetRow = (targetRow + 1) % rows;
    col[targetRow] = 'target';
  }

  function generateReelColumn(reelIndex, colOpts = {}) {
    const rows = getReelRows(reelIndex);
    const col = Array.from({ length: rows }, () =>
      pickRandomSymbol(reelIndex, { ...colOpts, omitScatter: true })
    );

    if (colOpts.forceScatter) {
      col[rng.randomInt(0, rows - 1)] = 'scatter';
      return col;
    }

    if (!colOpts.bonus && SCATTER_REELS.includes(reelIndex) && rng.random() < SCATTER_REEL_LAND_CHANCE) {
      col[rng.randomInt(0, rows - 1)] = 'scatter';
    }

    if (colOpts.bonus && reelIndex === BONUS_EXPAND_REEL && !isBonus4) {
      placeAtMostOneBonusTarget(col, rows);
    }

    return col;
  }

  function placeXNudgeStacksOnBoard(b) {
    const nudgeReels = getActiveXNudgeReels();
    const stacks = [];
    for (const reel of nudgeReels) {
      if (rng.random() > XNUDGE_LAND_CHANCE) continue;
      const rows = getReelRows(reel);
      const visible = rng.randomInt(1, Math.min(XNUDGE_STACK_SIZE, rows));
      for (let row = 0; row < visible; row++) b[reel][row] = 'xNudge';
      for (let row = visible; row < rows; row++) {
        b[reel][row] = pickRandomSymbol(reel);
      }
      stacks.push({ reel, visible });
    }
    return stacks;
  }

  function reelHasBonus4Builder(b, reel) {
    for (let row = 0; row < getReelRows(reel); row++) {
      const s = b[reel][row];
      if (s === 'xways4' || s === 'xwild4' || s === 'wild4') return true;
    }
    return false;
  }

  function placeBonus4Builders(b, torpedoSlots) {
    if (!isBonus4) return;
    for (const reel of BONUS4_TORPEDO_REELS) {
      const slot = BONUS4_TORPEDO_REELS.indexOf(reel);
      if (torpedoSlots[slot] != null) continue;
      if (getXNudgeVisibleCount(b[reel]) > 0) continue;
      if (reelHasBonus4Builder(b, reel)) continue;
      if (rng.random() > BONUS4_BUILDER_LAND_CHANCE) continue;
      let sym = null;
      if (BONUS4_XWAYS4_REELS.includes(reel)) sym = 'xways4';
      else if (BONUS4_XWILD4_REELS.includes(reel)) sym = 'xwild4';
      if (!sym) continue;
      b[reel][rng.randomInt(0, getReelRows(reel) - 1)] = sym;
    }
  }

  function generateRawBoard(torpedoSlots = [null, null, null, null]) {
    const b = activeReelRows.map((_, r) =>
      generateReelColumn(r, { bonus: bonusMode })
    );
    if (isBonus4) {
      if (getActiveXNudgeReels().length) placeXNudgeStacksOnBoard(b);
      placeBonus4Builders(b, torpedoSlots);
    } else if (getActiveXNudgeReels().length) {
      placeXNudgeStacksOnBoard(b);
    }
    return b;
  }

  function resolveXWays(b, m) {
    const replacement = PAYABLE[Math.floor(rng.random() * PAYABLE.length)];
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        if (b[r][row] === 'xWays') {
          b[r][row] = replacement;
          m[r][row] = rng.randomInt(2, 6);
        }
      }
    }
    return replacement;
  }

  function resolveXNudge(b, m, reelNudgeMult, excludeReels = []) {
    for (const reel of getActiveXNudgeReels()) {
      if (excludeReels.includes(reel)) continue;
      let visible = getXNudgeVisibleCount(b[reel]);
      if (visible === 0) continue;

      const rows = getReelRows(reel);
      const target = Math.min(getXNudgeStackSize(reel), rows);
      const nudges = target - visible;
      let mult = 1;

      for (let step = 0; step < nudges; step++) {
        mult += 1;
        b[reel][visible] = 'xNudge';
        visible += 1;
      }

      reelNudgeMult[reel] = mult;
      for (let row = 0; row < rows; row++) {
        b[reel][row] = 'wild';
        m[reel][row] = 1;
      }
    }
  }

  function findTargetOnBoard(b) {
    const rows = getReelRows(BONUS_EXPAND_REEL);
    for (let row = 0; row < rows; row++) {
      if (b[BONUS_EXPAND_REEL][row] === 'target') return row;
    }
    return -1;
  }

  function getFirstTwoReelsMatchSymbols(b) {
    const matched = [];
    for (const sym of PAYABLE) {
      let on0 = false;
      let on1 = false;
      for (let row = 0; row < getReelRows(0); row++) {
        if (cellMatches(sym, b[0][row])) on0 = true;
      }
      for (let row = 0; row < getReelRows(1); row++) {
        if (cellMatches(sym, b[1][row])) on1 = true;
      }
      if (on0 && on1) matched.push(sym);
    }
    return matched;
  }

  const state = { bonusTargetNudgeArtReel: false };

  function resolveBonusTarget(b, m, reelNudgeMult) {
    const targetRow = findTargetOnBoard(b);
    if (targetRow < 0) return;

    const matchSyms = getFirstTwoReelsMatchSymbols(b);
    if (!matchSyms.length) return;

    const chancePct = rng.randomInt(10, 75);
    const hit = rng.random() * 100 < chancePct;
    const reel = BONUS_EXPAND_REEL;

    if (!hit) {
      b[reel][targetRow] = 'wild';
      return;
    }

    state.bonusTargetNudgeArtReel = true;
    for (let row = 0; row <= targetRow; row++) b[reel][row] = 'xNudge';

    let visible = targetRow + 1;
    const rows = getReelRows(reel);
    const stackSize = rows;
    let reelMult = 1;
    reelNudgeMult[reel] = 1;

    const nudgesNeeded = stackSize - visible;
    for (let n = 0; n < nudgesNeeded; n++) {
      reelMult += 1;
      reelNudgeMult[reel] = reelMult;
      visible += 1;
    }

    for (let row = 0; row < rows; row++) {
      b[reel][row] = 'wild';
      m[reel][row] = 1;
    }
  }

  function countWaysOnReel(sym, b, m, reel, torpedoResolved) {
    let count = 0;
    for (let row = 0; row < getReelRows(reel); row++) {
      if (cellMatches(sym, b[reel][row])) count += m[reel][row] || 1;
    }
    if (torpedoResolved) {
      const slot = BONUS4_TORPEDO_REELS.indexOf(reel);
      if (slot >= 0) {
        const t = torpedoResolved[slot];
        if (t && cellMatches(sym, t.sym)) count += t.mult || 1;
      }
    }
    return count;
  }

  function calculateWaysWin(bet, b, m, reelNudgeMult, torpedoResolved = null) {
    let totalWin = 0;
    for (const sym of PAYABLE) {
      let reelsMatched = 0;
      let ways = 1;
      let nudgeLineMult = 1;

      for (let r = 0; r < NUM_REELS; r++) {
        const countOnReel = countWaysOnReel(sym, b, m, r, torpedoResolved);
        if (countOnReel === 0) break;
        reelsMatched++;
        ways *= countOnReel;
        nudgeLineMult *= reelNudgeMult[r] || 1;
      }

      if (reelsMatched < 3) continue;

      const payTable = PAYOUTS[sym];
      const payMult = payTable[reelsMatched] ?? payTable[6] ?? 0;
      const win = bet * payMult * ways * nudgeLineMult;
      if (win > 0) totalWin += win;
    }
    return totalWin;
  }

  function countScatters(b) {
    let n = 0;
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        if (b[r][row] === 'scatter') n++;
      }
    }
    return n;
  }

  function processTorpedoDrops(b, m, torpedoSlots) {
    for (const reel of BONUS4_TORPEDO_REELS) {
      const slot = BONUS4_TORPEDO_REELS.indexOf(reel);
      if (torpedoSlots[slot] != null) continue;
      for (let row = 0; row < getReelRows(reel); row++) {
        const sym = b[reel][row];
        if (sym === 'xways4' || sym === 'xwild4') {
          torpedoSlots[slot] = sym;
          b[reel][row] = 'wild4';
          m[reel][row] = 1;
          break;
        }
      }
    }
    return torpedoSlots.every((s) => s != null);
  }

  function resolveTorpedo(torpedoSlots) {
    const xwReplacement = PAYABLE[Math.floor(rng.random() * PAYABLE.length)];
    const resolved = [null, null, null, null];
    for (let slot = 0; slot < BONUS4_TORPEDO_REELS.length; slot++) {
      const torpedoSym = torpedoSlots[slot];
      if (!torpedoSym) continue;
      if (torpedoSym === 'xways4') {
        resolved[slot] = { sym: xwReplacement, mult: 2, reel: BONUS4_TORPEDO_REELS[slot] };
      } else if (torpedoSym === 'xwild4') {
        resolved[slot] = { sym: 'wild', mult: 2, reel: BONUS4_TORPEDO_REELS[slot] };
      }
    }
    return resolved;
  }

  function boardToIndices(b) {
    return b.map((col) => col.map((s) => {
      const ix = SYMBOLS.indexOf(s);
      return ix >= 0 ? ix : 0;
    }));
  }

  function makeSpinRecord(b, m, reelNudgeMult, seedLabel) {
    return {
      seed: seedLabel,
      reelIndices: boardToIndices(b),
      weights: cloneGrid(m),
      reelNudgeMult: reelNudgeMult.slice(),
      win: 0
    };
  }

  const ctx = {
    rng,
    bonusMode,
    bonusEntryScatterCount,
    bonusReelExpanded,
    activeReelRows,
    getReelRows,
    getActiveXNudgeReels,
    getActiveXWAYSReels,
    generateRawBoard,
    resolveXWays,
    resolveXNudge,
    resolveBonusTarget,
    calculateWaysWin,
    countScatters,
    processTorpedoDrops,
    resolveTorpedo,
    makeSpinRecord,
    pickRandomSymbol,
    placeXNudgeStacksOnBoard,
    generateReelColumn,
    isBonus3,
    isBonus4
  };

  Object.defineProperty(ctx, 'bonusTargetNudgeArtReel', {
    get: () => state.bonusTargetNudgeArtReel,
    set: (v) => { state.bonusTargetNudgeArtReel = !!v; }
  });

  return ctx;
}

function simulateBaseSpinOutcome(landingIndices, ctx) {
  const b = landingIndices.map((col, r) =>
    col.map((ix) => SYMBOLS[ix] || 'low1')
  );
  const m = landingIndices.map((col) => col.map(() => 1));
  const reelNudgeMult = [1, 1, 1, 1, 1, 1];

  const stacks = [];
  for (const reel of ctx.getActiveXNudgeReels()) {
    let visible = getXNudgeVisibleCount(b[reel]);
    if (visible > 0) stacks.push({ reel, visible });
  }

  ctx.resolveXWays(b, m);
  ctx.resolveXNudge(b, m, reelNudgeMult);

  const win = ctx.calculateWaysWin(1, b, m, reelNudgeMult);
  const scatters = ctx.countScatters(b);

  return {
    board: b,
    mults: m,
    reelNudgeMult,
    win,
    scatters,
    stacks
  };
}

function bookRngSeed(bookId, attempt = 0) {
  return ((Number(bookId) * 31337 + 17 + Number(attempt) * 7919) >>> 0);
}

/** Доска без 3+ подряд слева (fallback, если random не нашёл 0×). */
function buildGuaranteedZeroWinLandingIndices() {
  const perReel = ['low1', 'low2', 'low3', 'low4', 'high2', 'high3'];
  return BASE_REEL_ROWS.map((rows, r) => {
    const ix = SYMBOLS.indexOf(perReel[r]);
    return Array.from({ length: rows }, () => ix);
  });
}

/**
 * Случайный базовый спин с реальным 0× (win=0, scatter<3).
 * Не подменяет выплату — доска совпадает с расчётом ways.
 */
function makeGenuineMissOutcome(bookId, opts = {}) {
  const maxTries = Number(opts.maxTries) || 400;

  for (let t = 0; t < maxTries; t++) {
    const rng = createRng(bookRngSeed(bookId, t));
    const ctx = makeSimCtx(rng);
    const b = ctx.generateRawBoard();
    const land = b.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
    const outcome = simulateBaseSpinOutcome(land, ctx);
    if (outcome.win <= 0.0001 && outcome.scatters < 3) {
      return { landingIndices: land, outcome };
    }
  }

  const land = buildGuaranteedZeroWinLandingIndices();
  const ctx = makeSimCtx(createRng(bookRngSeed(bookId, 9999)));
  const outcome = simulateBaseSpinOutcome(land, ctx);
  return { landingIndices: land, outcome };
}

function generateBaseLandingIndices(ctx) {
  const b = ctx.generateRawBoard();
  return ctx.makeSpinRecord(b, b.map((col) => col.map(() => 1)), [1, 1, 1, 1, 1, 1], '').reelIndices;
}

function buildBoardWithScatterCount(scatterCount, rng) {
  const need = scatterCount >= 4 ? 4 : 3;
  const tmpCtx = makeSimCtx(rng, { bonusMode: false });
  const b = BASE_REEL_ROWS.map((_, r) =>
    tmpCtx.generateReelColumn(r, { bonus: false, omitScatter: true })
  );

  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
      if (b[r][row] === 'scatter') {
        b[r][row] = tmpCtx.pickRandomSymbol(r, { omitScatter: true });
      }
    }
  }

  const reels = need === 4
    ? [...SCATTER_REELS]
    : [...SCATTER_REELS].sort(() => rng.random() - 0.5).slice(0, 3);

  for (const r of reels) {
    b[r][rng.randomInt(0, BASE_REEL_ROWS[r] - 1)] = 'scatter';
  }

  return b.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
}

function simulateBonus3Spin(ctx, spinTag) {
  ctx.bonusTargetNudgeArtReel = false;
  const b = ctx.generateRawBoard();
  const m = ctx.activeReelRows.map((rows) => Array.from({ length: rows }, () => 1));
  const reelNudgeMult = [1, 1, 1, 1, 1, 1];

  ctx.resolveBonusTarget(b, m, reelNudgeMult);
  ctx.resolveXWays(b, m);
  ctx.resolveXNudge(b, m, reelNudgeMult, [BONUS_EXPAND_REEL]);

  const win = ctx.calculateWaysWin(1, b, m, reelNudgeMult);
  const record = ctx.makeSpinRecord(b, m, reelNudgeMult, spinTag);
  record.win = win;
  return { spinRecord: record, bonusWin: win };
}

function simulateBonus4Spin(ctx, torpedoSlots, spinTag) {
  const b = ctx.generateRawBoard(torpedoSlots);
  const m = ctx.activeReelRows.map((rows) => Array.from({ length: rows }, () => 1));
  const reelNudgeMult = [1, 1, 1, 1, 1, 1];

  ctx.resolveXWays(b, m);
  ctx.resolveXNudge(b, m, reelNudgeMult);

  const torpedoFull = ctx.processTorpedoDrops(b, m, torpedoSlots);
  let torpedoResolved = null;
  if (torpedoFull) torpedoResolved = ctx.resolveTorpedo(torpedoSlots);

  const win = ctx.calculateWaysWin(1, b, m, reelNudgeMult, torpedoResolved);
  const record = ctx.makeSpinRecord(b, m, reelNudgeMult, spinTag);
  record.win = win;

  if (torpedoFull) {
    for (let i = 0; i < torpedoSlots.length; i++) torpedoSlots[i] = null;
  }

  return { spinRecord: record, bonusWin: win, torpedoFull };
}

function simulateBonusGame(scatterCount, bookId, makeSpinSeed) {
  const fsCount = scatterCount >= 4 ? BONUS_SPINS_FOR_4 : BONUS_SPINS_FOR_3;
  const bonusRng = createRng((bookId * 9973 + scatterCount * 131) >>> 0);
  const activeReelRows = scatterCount >= 4
    ? BASE_REEL_ROWS.slice()
    : BASE_REEL_ROWS.map((rows, i) => (i === BONUS_EXPAND_REEL ? BONUS_EXPAND_ROWS : rows));

  const ctx = makeSimCtx(bonusRng, {
    bonusMode: true,
    bonusEntryScatterCount: scatterCount,
    bonusReelExpanded: scatterCount < 4,
    activeReelRows
  });

  const bonusSpins = [];
  let totalBonusWin = 0;
  const torpedoSlots = [null, null, null, null];

  for (let s = 0; s < fsCount; s++) {
    const tag = makeSpinSeed(bookId, s + 1, [], [], 'xb');
    let result;
    if (scatterCount >= 4) {
      result = simulateBonus4Spin(ctx, torpedoSlots, tag);
    } else {
      result = simulateBonus3Spin(ctx, tag);
    }
    bonusSpins.push(result.spinRecord);
    totalBonusWin += result.bonusWin;
  }

  return { bonusSpins, totalBonusWin };
}

function makeSpinSeed(bookId, tag, reelIndicesGrid, weightsGrid, prefix = 'xb') {
  const parts = [Number(bookId), Number(tag) || 0];
  if (reelIndicesGrid?.length) {
    for (let r = 0; r < reelIndicesGrid.length; r++) {
      for (let row = 0; row < reelIndicesGrid[r].length; row++) {
        parts.push(reelIndicesGrid[r][row]);
        parts.push(weightsGrid?.[r]?.[row] ?? 1);
      }
    }
  }
  let h = 5381 >>> 0;
  for (const n of parts) {
    h = ((h << 5) + h + (Number(n) | 0)) >>> 0;
  }
  return `${prefix}_${Number(bookId).toString(36)}_${(h >>> 0).toString(36)}`;
}

function winMultiplier(winAmount, baseBet = 1) {
  const b = Number(baseBet) || 1;
  const w = Number(winAmount) || 0;
  return b > 0 ? w / b : w;
}

module.exports = {
  SYMBOLS,
  BASE_REEL_ROWS,
  NUM_REELS,
  PAYOUTS,
  PAYABLE,
  createRng,
  makeSimCtx,
  simulateBaseSpinOutcome,
  bookRngSeed,
  buildGuaranteedZeroWinLandingIndices,
  makeGenuineMissOutcome,
  generateBaseLandingIndices,
  buildBoardWithScatterCount,
  simulateBonusGame,
  makeSpinSeed,
  winMultiplier,
  countScattersFromBoard(b, rows = BASE_REEL_ROWS) {
    let n = 0;
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < rows[r]; row++) {
        if (b[r][row] === 'scatter') n++;
      }
    }
    return n;
  }
};
