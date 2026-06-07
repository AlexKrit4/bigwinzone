'use strict';

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');

const {
  SYMBOLS,
  BASE_REEL_ROWS,
  NUM_REELS,
  createRng,
  makeSimCtx,
  simulateBaseSpinOutcome,
  buildBoardWithScatterCount,
  simulateBonusGame,
  makeSpinSeed,
  makeGenuineMissOutcome
} = require('./xboot-slot-sim.js');

const {
  RECORD_SIZE,
  SHARD_HEADER_SIZE,
  encodeRecord,
  writeShardHeader
} = require('./xboot-books-v2.js');

const { buildSyntheticMaxWinBook } = require('./jackpot-boards.js');

function bookRngSeed(bookId, attempt = 0) {
  return ((Number(bookId) * 31337 + 17 + Number(attempt) * 7919) >>> 0);
}

function spinRecordFromOutcome(outcome, seedLabel) {
  const reelIndices = outcome.board.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
  return {
    seed: seedLabel,
    reelIndices,
    weights: outcome.mults.map((col) => [...col]),
    reelNudgeMult: outcome.reelNudgeMult.slice(),
    win: outcome.win
  };
}

function makeBookForBucket(bookId, bucket, config) {
  if (bucket === 'jackpot') {
    const book = buildSyntheticMaxWinBook(bookId, config);
    return {
      id: bookId,
      hasBonus: true,
      isJackpot: true,
      scatterCount: 4,
      spin: {
        seed: book.spin.seed,
        win: book.spin.win,
        reelIndices: book.spin.reelIndices,
        weights: book.spin.weights,
        reelNudgeMult: book.spin.reelNudgeMult
      },
      bonusWin: book.bonusWin,
      totalWin: book.totalWin
    };
  }

  const rng = createRng(bookRngSeed(bookId, 0));
  const ctx = makeSimCtx(rng);
  let landingIndices = null;
  let outcome = null;

  if (bucket === 'miss') {
    const miss = makeGenuineMissOutcome(bookId);
    landingIndices = miss.landingIndices;
    outcome = miss.outcome;
    const baseSpinSeed = makeSpinSeed(
      bookId,
      0,
      landingIndices,
      outcome.mults.map((c) => [...c]),
      config.seedIdPrefix || 'xb'
    );
    return {
      id: bookId,
      hasBonus: false,
      isJackpot: false,
      scatterCount: outcome.scatters,
      spin: {
        seed: baseSpinSeed,
        win: outcome.win,
        reelIndices: landingIndices,
        weights: outcome.mults.map((c) => [...c]),
        reelNudgeMult: outcome.reelNudgeMult.slice()
      },
      bonusWin: 0,
      totalWin: outcome.win
    };
  } else if (bucket === 'bonus3') {
    landingIndices = buildBoardWithScatterCount(3, rng);
  } else if (bucket === 'bonus4') {
    landingIndices = buildBoardWithScatterCount(4, rng);
  } else {
    const HIT_MAX_WIN = 8;
    for (let t = 0; t < 300; t++) {
      const rng2 = createRng(bookRngSeed(bookId, t));
      const ctx2 = makeSimCtx(rng2);
      const b = ctx2.generateRawBoard();
      const land = b.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
      const tmp = simulateBaseSpinOutcome(land, ctx2);
      if (tmp.scatters < 3 && tmp.win > 0 && tmp.win <= HIT_MAX_WIN) {
        landingIndices = land;
        outcome = tmp;
        break;
      }
    }
    if (!landingIndices) {
      for (let t = 0; t < 200; t++) {
        const rng2 = createRng(bookRngSeed(bookId, 400 + t));
        const ctx2 = makeSimCtx(rng2);
        const b = ctx2.generateRawBoard();
        const land = b.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
        const tmp = simulateBaseSpinOutcome(land, ctx2);
        if (tmp.scatters < 3) {
          landingIndices = land;
          outcome = tmp;
          break;
        }
      }
    }
    if (!landingIndices) {
      const miss = makeGenuineMissOutcome(bookId, { maxTries: 200 });
      landingIndices = miss.landingIndices;
      outcome = miss.outcome;
    }
  }

  if (!outcome) outcome = simulateBaseSpinOutcome(landingIndices, ctx);
  const scatterCount = outcome.scatters;

  const baseSpin = spinRecordFromOutcome(outcome, '');
  const baseSpinSeed = makeSpinSeed(bookId, 0, baseSpin.reelIndices, baseSpin.weights, config.seedIdPrefix || 'xb');
  baseSpin.seed = baseSpinSeed;

  const book = {
    id: bookId,
    hasBonus: false,
    isJackpot: false,
    scatterCount,
    spin: {
      seed: baseSpinSeed,
      win: outcome.win,
      reelIndices: baseSpin.reelIndices,
      weights: baseSpin.weights,
      reelNudgeMult: baseSpin.reelNudgeMult
    },
    bonusWin: 0,
    totalWin: outcome.win
  };

  if (bucket === 'bonus3' || bucket === 'bonus4') {
    const sc = bucket === 'bonus4' ? 4 : 3;
    const { totalBonusWin } = simulateBonusGame(sc, bookId, makeSpinSeed);
    book.hasBonus = true;
    book.scatterCount = sc;
    book.bonusWin = totalBonusWin;
    book.totalWin = outcome.win + totalBonusWin;
  } else if (scatterCount >= 3) {
    /* hit/miss: случайные 3+ scatter перегенерируем как miss */
    return makeBookForBucket(bookId, 'miss', config);
  }

  return book;
}

function run() {
  const {
    shardPath,
    shardId,
    startId,
    count,
    buckets,
    config
  } = workerData;

  const fd = fs.openSync(shardPath, 'w+');
  writeShardHeader(fd);

  let written = 0;
  const t0 = Date.now();

  for (let local = 0; local < count; local++) {
    const globalId = startId + local;
    const bucket = buckets[local] || 'miss';
    const book = makeBookForBucket(globalId, bucket, config);
    book.id = globalId;
    const buf = encodeRecord(book);
    const off = SHARD_HEADER_SIZE + local * RECORD_SIZE;
    fs.writeSync(fd, buf, 0, buf.length, off);
    written++;

    if (written % 100000 === 0) {
      parentPort.postMessage({
        type: 'progress',
        shardId,
        written,
        count,
        ms: Date.now() - t0
      });
    }
  }

  fs.closeSync(fd);
  parentPort.postMessage({
    type: 'done',
    shardId,
    written,
    ms: Date.now() - t0
  });
}

run();
