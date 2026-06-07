/**
 * Математика слота Red Devil (Das xBoot-style).
 * 6 барабанов: 2-3-4-4-3-2, ways слева направо, xWays / xNudge.
 */

const REEL_ROWS = [2, 3, 4, 4, 3, 2];
const NUM_REELS = 6;
const XNUDGE_REELS = [2, 3];
const XNUDGE_STACK_SIZE = 4;
const XNUDGE_LAND_CHANCE = 0.14;

const SYMBOLS = [
  'low1', 'low2', 'low3', 'low4', 'low5',
  'high1', 'high2', 'high3', 'high4', 'high5',
  'scatter', 'xWays', 'xNudge', 'wild'
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
const XWAYS_REDUCTION = 12;
const XWAYS_REELS = [1, 4];
const SCATTER_WEIGHT = 0.22;
/** Скаттер только на барабанах 2–5 (индексы 1–4) */
const SCATTER_REELS = [1, 2, 3, 4];
const SCATTER_REEL_LAND_CHANCE = 0.11;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getSymbolWeight(name, reelIndex = -1) {
  if (name === 'xWays') {
    return reelIndex >= 0 && XWAYS_REELS.includes(reelIndex) ? 1 / XWAYS_REDUCTION : 0;
  }
  if (name === 'xNudge' || name === 'wild') return 0;
  if (name === 'scatter') {
    return reelIndex >= 0 && SCATTER_REELS.includes(reelIndex) ? SCATTER_WEIGHT : 0;
  }
  return 1;
}

function pickRandomSymbolIndex(reelIndex = -1) {
  const weights = SYMBOLS.map((name) => getSymbolWeight(name, reelIndex));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

function emptyBoard() {
  return Array.from({ length: NUM_REELS }, (_, r) =>
    Array.from({ length: REEL_ROWS[r] }, () => SYMBOLS[pickRandomSymbolIndex(r)])
  );
}

function emptyMults() {
  return Array.from({ length: NUM_REELS }, (_, r) =>
    Array.from({ length: REEL_ROWS[r] }, () => 1)
  );
}

function cellMatches(sym, cell) {
  return cell === sym || cell === 'wild';
}

function placeXNudgeStacksOnBoard(board) {
  const stacks = [];
  for (const reel of XNUDGE_REELS) {
    if (Math.random() > XNUDGE_LAND_CHANCE) continue;
    const rows = REEL_ROWS[reel];
    const visible = randomInt(1, Math.min(XNUDGE_STACK_SIZE, rows));
    for (let row = 0; row < visible; row++) board[reel][row] = 'xNudge';
    for (let row = visible; row < rows; row++) {
      board[reel][row] = SYMBOLS[pickRandomSymbolIndex(reel)];
    }
    stacks.push({ reel, visible });
  }
  return stacks;
}

function resolveXWays(board, mults) {
  const replacement = PAYABLE[Math.floor(Math.random() * PAYABLE.length)];
  let had = false;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < REEL_ROWS[r]; row++) {
      if (board[r][row] !== 'xWays') continue;
      had = true;
      board[r][row] = replacement;
      mults[r][row] = randomInt(2, 6);
    }
  }
  return { had, replacement };
}

/** xNudge-стопка на барабанах 3–4: по одному ряду вниз, множитель +1 за толчок. */
function resolveXNudge(board, mults) {
  const reelNudgeMult = Array(NUM_REELS).fill(1);
  const events = [];

  for (const reel of XNUDGE_REELS) {
    let visible = 0;
    for (let row = 0; row < REEL_ROWS[reel]; row++) {
      if (board[reel][row] === 'xNudge') visible += 1;
      else break;
    }
    if (visible === 0) continue;

    let mult = 1;
    const target = Math.min(XNUDGE_STACK_SIZE, REEL_ROWS[reel]);
    const nudges = target - visible;

    for (let step = 0; step < nudges; step++) {
      mult += 1;
      const expandRow = visible;
      board[reel][expandRow] = 'xNudge';
      visible += 1;
      events.push({ reel, step, mult, expandRow, visible });
    }

    reelNudgeMult[reel] = mult;
    for (let row = 0; row < REEL_ROWS[reel]; row++) {
      board[reel][row] = 'wild';
      mults[reel][row] = 1;
    }
  }

  return { had: events.length > 0, events, reelNudgeMult };
}

function calculateWaysWin(bet, board, mults, reelNudgeMult = null) {
  const nudgeMult = reelNudgeMult || Array(NUM_REELS).fill(1);
  let totalWin = 0;
  const wins = [];

  for (const sym of PAYABLE) {
    let reelsMatched = 0;
    let ways = 1;
    let nudgeLineMult = 1;

    for (let r = 0; r < NUM_REELS; r++) {
      let countOnReel = 0;
      for (let row = 0; row < REEL_ROWS[r]; row++) {
        if (cellMatches(sym, board[r][row])) {
          countOnReel += mults[r][row] || 1;
        }
      }
      if (countOnReel === 0) break;
      reelsMatched++;
      ways *= countOnReel;
      nudgeLineMult *= nudgeMult[r] || 1;
    }

    if (reelsMatched < 3) continue;

    const payTable = PAYOUTS[sym];
    const payMult = payTable[reelsMatched] ?? payTable[6] ?? 0;
    const win = bet * payMult * ways * nudgeLineMult;
    if (win > 0) {
      totalWin += win;
      wins.push({ sym, reelsMatched, ways, nudgeLineMult, payMult, win });
    }
  }

  return { totalWin, wins };
}

function countScatters(board) {
  let n = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < REEL_ROWS[r]; row++) {
      if (board[r][row] === 'scatter') n++;
    }
  }
  return n;
}

function generateSpinOutcome() {
  const board = emptyBoard();
  const mults = emptyMults();
  placeXNudgeStacksOnBoard(board);
  const xw = resolveXWays(board, mults);
  const xn = resolveXNudge(board, mults);
  return {
    board,
    mults,
    xWays: xw,
    xNudge: xn,
    reelNudgeMult: xn.reelNudgeMult,
    scatters: countScatters(board)
  };
}

module.exports = {
  REEL_ROWS,
  NUM_REELS,
  XWAYS_REELS,
  XNUDGE_REELS,
  XNUDGE_STACK_SIZE,
  SYMBOLS,
  PAYOUTS,
  PAYABLE,
  generateSpinOutcome,
  placeXNudgeStacksOnBoard,
  resolveXWays,
  resolveXNudge,
  calculateWaysWin,
  countScatters,
  emptyBoard,
  emptyMults
};
