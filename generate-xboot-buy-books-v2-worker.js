'use strict';

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');

const {
  SYMBOLS,
  createRng,
  makeSimCtx,
  simulateBaseSpinOutcome,
  buildBoardWithScatterCount,
  simulateBonusGame,
  makeSpinSeed,
  bookRngSeed
} = require('./xboot-slot-sim.js');

const {
  RECORD_SIZE,
  SHARD_HEADER_SIZE,
  encodeRecord,
  writeShardHeader
} = require('./xboot-books-v2.js');

const MAX_WIN_EXCLUDE = 55200;

function makeBuyBook(bookId, scatterCount, seedIdPrefix) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const rng = createRng(bookRngSeed(bookId, attempt));
    const ctx = makeSimCtx(rng);
    const landingIndices = buildBoardWithScatterCount(scatterCount, rng);
    const outcome = simulateBaseSpinOutcome(landingIndices, ctx);
    if (outcome.scatters !== scatterCount) continue;

    const reelIndices = outcome.board.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
    const weights = outcome.mults.map((col) => [...col]);
    const baseSpinSeed = makeSpinSeed(
      bookId,
      0,
      reelIndices,
      weights,
      seedIdPrefix
    );

    const { totalBonusWin } = simulateBonusGame(
      scatterCount,
      bookId,
      (bId, tag, ri, wg, prefix) => makeSpinSeed(bId, tag, ri, wg, prefix || seedIdPrefix)
    );

    const totalWin = outcome.win + totalBonusWin;
    if (totalWin >= MAX_WIN_EXCLUDE) continue;

    return {
      id: bookId,
      hasBonus: true,
      isJackpot: false,
      scatterCount,
      spin: {
        seed: baseSpinSeed,
        win: outcome.win,
        reelIndices,
        weights,
        reelNudgeMult: outcome.reelNudgeMult.slice()
      },
      bonusWin: totalBonusWin,
      totalWin
    };
  }

  const rng = createRng(bookRngSeed(bookId, 9999));
  const ctx = makeSimCtx(rng);
  const landingIndices = buildBoardWithScatterCount(scatterCount, rng);
  const outcome = simulateBaseSpinOutcome(landingIndices, ctx);
  const reelIndices = outcome.board.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
  const weights = outcome.mults.map((col) => [...col]);
  const baseSpinSeed = makeSpinSeed(bookId, 0, reelIndices, weights, seedIdPrefix);
  const { totalBonusWin } = simulateBonusGame(
    scatterCount,
    bookId,
    (bId, tag, ri, wg, prefix) => makeSpinSeed(bId, tag, ri, wg, prefix || seedIdPrefix)
  );
  let totalWin = outcome.win + totalBonusWin;
  if (totalWin >= MAX_WIN_EXCLUDE) {
    totalWin = MAX_WIN_EXCLUDE - 0.01;
  }

  return {
    id: bookId,
    hasBonus: true,
    isJackpot: false,
    scatterCount,
    spin: {
      seed: baseSpinSeed,
      win: outcome.win,
      reelIndices,
      weights,
      reelNudgeMult: outcome.reelNudgeMult.slice()
    },
    bonusWin: Math.max(0, totalWin - outcome.win),
    totalWin
  };
}

function run() {
  const { shardPath, shardId, startId, count, scatterCount, seedIdPrefix } = workerData;

  const fd = fs.openSync(shardPath, 'w+');
  writeShardHeader(fd);

  let written = 0;
  const t0 = Date.now();

  for (let local = 0; local < count; local++) {
    const globalId = startId + local;
    const book = makeBuyBook(globalId, scatterCount, seedIdPrefix);
    book.id = globalId;
    const buf = encodeRecord(book);
    const off = SHARD_HEADER_SIZE + local * RECORD_SIZE;
    fs.writeSync(fd, buf, 0, buf.length, off);
    written++;

    if (written % 50000 === 0) {
      parentPort.postMessage({
        type: 'progress',
        shardId,
        written,
        count,
        elapsedMs: Date.now() - t0
      });
    }
  }

  fs.closeSync(fd);
  parentPort.postMessage({
    type: 'done',
    shardId,
    written,
    elapsedMs: Date.now() - t0
  });
}

run();
