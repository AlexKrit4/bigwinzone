'use strict';

/**
 * Генератор 100 000 книг базовых спинов Das xBoot.
 * Цели: RTP 96.03%, hit 22.17%, Free Spins ~1/211, max win 55 200×.
 */

const fs = require('fs');
const path = require('path');

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
  winMultiplier,
  makeGenuineMissOutcome
} = require('./xboot-slot-sim.js');

const TOTAL_BOOKS = 100000;
const DEFAULT_TARGET_RTP_PCT = 96.0;
const DEFAULT_TARGET_HIT_RATE = 0.2217;
const DEFAULT_TARGET_BONUS_RATE = 1 / 211;
const RTP_ADJUST_TOLERANCE_PCT = 0.55;
const HIT_RATE_TOLERANCE = 150;
const BONUS_RATE_TOLERANCE = 8;

const MAX_WIN_BOOK_ID = 99_999;

const { buildBuy3MaxWinBook, buildBuy4MaxWinBook, MAX_WIN_AT_BET1 } = require('./jackpot-boards.js');

function encodeReelsLine(spin) {
  const parts = [];
  for (let r = 0; r < NUM_REELS; r++) {
    parts.push(spin[`reel${r}`].join(','));
  }
  return parts.join('|');
}

function encodeWeightsLine(weightsGrid) {
  return weightsGrid.map((row) => row.join(',')).join('|');
}

function encodeNudgeLine(reelNudgeMult) {
  return reelNudgeMult.map((n) => Number(n) || 1).join(',');
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

function syncSpinObject(spin) {
  for (let r = 0; r < NUM_REELS; r++) {
    spin[`reel${r}`] = spin.reelIndices[r];
    spin.weights[r] = spin.weights[r] || spin.reelIndices[r].map(() => 1);
  }
}

function computeRtpMetrics(books, spinCostMult = 1, capPayoutAtBet1 = 0) {
  const bookCount = books.length || TOTAL_BOOKS;
  const totalPaidBet = bookCount * spinCostMult;
  const cap = Number(capPayoutAtBet1) > 0 ? Number(capPayoutAtBet1) : 0;
  /** Джекпот-книга не входит в циклический RTP (редкое событие 1/64M). */
  const payout = (b) => {
    if (b?.id === MAX_WIN_BOOK_ID) return 0;
    const w = Number(b.totalWin) || 0;
    return cap > 0 ? Math.min(w, cap) : w;
  };
  const totalWin = books.reduce((s, b) => s + payout(b), 0);
  const sumBaseWin = books.reduce((s, b) => s + Number(b.spin.win), 0);
  const rtp = totalPaidBet > 0 ? (totalWin / totalPaidBet) * 100 : 0;
  const rtpBaseSpinOnlyPct = totalPaidBet > 0 ? (sumBaseWin / totalPaidBet) * 100 : 0;
  return { totalPaidBet, totalWin, sumBaseWin, rtp, rtpBaseSpinOnlyPct };
}

function isBookHit(book) {
  return Number(book?.totalWin) > 0;
}

function computeHitRateMetrics(books) {
  const hitCount = books.filter(isBookHit).length;
  const missCount = books.length - hitCount;
  const hitRatePct = books.length > 0 ? (hitCount / books.length) * 100 : 0;
  return { hitCount, missCount, hitRatePct };
}

function computeBonusRateMetrics(books) {
  const bonusCount = books.filter((b) => b.hasBonus).length;
  const bonusRatePct = books.length > 0 ? (bonusCount / books.length) * 100 : 0;
  return { bonusCount, bonusRatePct };
}

function bookRngSeed(bookId, attempt = 0) {
  return ((Number(bookId) * 31337 + 17 + Number(attempt) * 7919) >>> 0);
}

function makeBookAtIndex(i, config, opts = {}) {
  const { scatterGuarantee = 0, seedIdPrefix = 'xb' } = config;
  const attempt = Number(opts.attempt) || 0;
  const rng = createRng(bookRngSeed(i, attempt));
  const ctx = makeSimCtx(rng);

  let landingIndices = null;
  let outcome = null;
  const forceBonus = opts.forceBonus === 3 || opts.forceBonus === 4 ? opts.forceBonus : 0;

  if (opts.forceMiss) {
    const miss = makeGenuineMissOutcome(i, { maxTries: 400 });
    landingIndices = miss.landingIndices;
    outcome = miss.outcome;
  } else if (scatterGuarantee === 3 || scatterGuarantee === 4 || forceBonus) {
    const sc = scatterGuarantee || forceBonus;
    landingIndices = buildBoardWithScatterCount(sc, rng);
  } else if (opts.forceNoBonus) {
    for (let t = 0; t < 350; t++) {
      const rng2 = createRng(bookRngSeed(i, attempt + t));
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
    if (!landingIndices) {
      const miss = makeGenuineMissOutcome(i, { maxTries: 200 });
      landingIndices = miss.landingIndices;
      outcome = miss.outcome;
    }
  } else {
    const b = ctx.generateRawBoard();
    landingIndices = b.map((col) => col.map((s) => SYMBOLS.indexOf(s)));
  }

  if (!outcome) outcome = simulateBaseSpinOutcome(landingIndices, ctx);
  const scatterCount = outcome.scatters;

  const baseSpin = spinRecordFromOutcome(outcome, '');
  syncSpinObject(baseSpin);
  const baseSpinSeed = makeSpinSeed(i, 0, baseSpin.reelIndices, baseSpin.weights, seedIdPrefix);
  baseSpin.seed = baseSpinSeed;

  const book = {
    id: i,
    seed: baseSpinSeed,
    hasBonus: false,
    scatterCount,
    spin: {
      seed: baseSpinSeed,
      win: outcome.win,
      winMultiplier: winMultiplier(outcome.win, 1),
      reelIndices: baseSpin.reelIndices,
      weights: baseSpin.weights,
      reelNudgeMult: baseSpin.reelNudgeMult
    },
    totalWin: outcome.win,
    totalWinMultiplier: winMultiplier(outcome.win, 1)
  };

  syncSpinObject(book.spin);

  if (scatterCount >= 3) {
    const { bonusSpins, totalBonusWin } = simulateBonusGame(scatterCount, i, (bookId, tag, ri, wg, prefix) =>
      makeSpinSeed(bookId, tag, ri, wg, prefix || seedIdPrefix)
    );

    for (let s = 0; s < bonusSpins.length; s++) {
      const bs = bonusSpins[s];
      syncSpinObject(bs);
      for (let r = 0; r < NUM_REELS; r++) {
        bs[`reel${r}`] = bs.reelIndices[r];
      }
    }

    book.hasBonus = true;
    book.bonusSpins = bonusSpins;
    book.bonusWin = totalBonusWin;
    book.totalWin = outcome.win + totalBonusWin;
    book.totalWinMultiplier = winMultiplier(book.totalWin, 1);
  }

  return book;
}

function makeBookAtIndexForHitClass(i, config, wantHit) {
  if (!wantHit) {
    const book = makeBookAtIndex(i, config, { attempt: 0, forceMiss: true });
    if (!isBookHit(book)) return book;
    for (let t = 1; t < 200; t++) {
      const b = makeBookAtIndex(i, config, { attempt: t, forceNoBonus: true });
      if (!isBookHit(b)) return b;
    }
    return makeBookAtIndex(i, config, { forceMiss: true });
  }

  for (let t = 0; t < 400; t++) {
    const book = makeBookAtIndex(i, config, { attempt: t, forceNoBonus: true });
    if (book.totalWin > 0) return book;
  }
  return makeBookAtIndex(i, config, { attempt: 999, forceBonus: 3 });
}

function makeBookAtIndexForBonusClass(i, config, wantBonus) {
  if (wantBonus) {
    let best = null;
    for (let t = 0; t < 40; t++) {
      const book = makeBookAtIndex(i, config, { attempt: t, forceBonus: 3 });
      if (!best || book.totalWin < best.totalWin) best = book;
    }
    return best || makeBookAtIndex(i, config, { forceBonus: 3 });
  }
  for (let t = 0; t < 250; t++) {
    const book = makeBookAtIndex(i, config, { attempt: t, forceNoBonus: true });
    if (!book.hasBonus) return book;
  }
  return makeBookAtIndex(i, config, { forceMiss: true });
}

function adjustBooksToTargetHitRate(books, config, targetHitRate) {
  const targetHits = Math.round(books.length * targetHitRate);
  let pass = 0;
  const maxPasses = 400;

  while (pass < maxPasses) {
    const { hitCount } = computeHitRateMetrics(books);
    const gap = targetHits - hitCount;
    if (Math.abs(gap) <= HIT_RATE_TOLERANCE) {
      const hr = computeHitRateMetrics(books);
      console.log(`Hit rate: ${hr.hitRatePct.toFixed(2)}% (${hr.hitCount} hit / ${hr.missCount} miss)`);
      return hr;
    }

    const needMoreHits = gap > 0;
    const batchSize = Math.min(2500, Math.max(50, Math.abs(gap)));
    const candidates = books
      .map((b, idx) => ({ idx, hit: isBookHit(b), w: Number(b.totalWin) }))
      .filter((x) => (needMoreHits ? !x.hit : x.hit))
      .sort((a, b) => (needMoreHits ? a.w - b.w : b.w - a.w));

    for (let k = 0; k < batchSize && k < candidates.length; k++) {
      const bookIdx = candidates[k].idx;
      books[bookIdx] = makeBookAtIndexForHitClass(bookIdx, config, needMoreHits);
    }
    pass++;
    if (pass === 1 || pass % 15 === 0) {
      const hr = computeHitRateMetrics(books);
      console.log(`  hit-коррекция проход ${pass}: ${hr.hitRatePct.toFixed(2)}%`);
    }
  }

  return computeHitRateMetrics(books);
}

function adjustBooksToTargetBonusRate(books, config, targetBonusRate) {
  const targetBonuses = Math.round(books.length * targetBonusRate);
  let pass = 0;
  const maxPasses = 500;

  while (pass < maxPasses) {
    const { bonusCount } = computeBonusRateMetrics(books);
    const gap = targetBonuses - bonusCount;
    if (Math.abs(gap) <= BONUS_RATE_TOLERANCE) {
      const br = computeBonusRateMetrics(books);
      console.log(`Bonus rate: ${br.bonusRatePct.toFixed(3)}% (${br.bonusCount} FS-триггеров)`);
      return br;
    }

    const needMore = gap > 0;
    const batchSize = Math.min(2000, Math.max(30, Math.abs(gap)));
    const candidates = books
      .map((b, idx) => ({ idx, bonus: b.hasBonus, w: Number(b.totalWin) }))
      .filter((x) => (needMore ? !x.bonus : x.bonus))
      .sort((a, b) => (needMore ? a.w - b.w : b.w - a.w));

    for (let k = 0; k < batchSize && k < candidates.length; k++) {
      const bookIdx = candidates[k].idx;
      books[bookIdx] = makeBookAtIndexForBonusClass(bookIdx, config, needMore);
    }
    pass++;
    if (pass === 1 || pass % 20 === 0) {
      const br = computeBonusRateMetrics(books);
      console.log(`  bonus-коррекция проход ${pass}: ${br.bonusRatePct.toFixed(3)}%`);
    }
  }

  return computeBonusRateMetrics(books);
}

function makeBookReplacement(bookIdx, config, oldBook) {
  if (config.targetHitRate > 0) {
    return makeBookAtIndexForHitClass(bookIdx, config, isBookHit(oldBook));
  }
  return makeBookAtIndex(bookIdx, config);
}

function makeBookAtIndexMinWin(i, config, minTotalWin) {
  const floor = Math.max(0, Number(minTotalWin) || 0);
  for (let t = 0; t < 500; t++) {
    const book = makeBookAtIndex(i, config, { attempt: t, forceNoBonus: true });
    if (book.totalWin >= floor) return book;
  }
  for (let t = 0; t < 150; t++) {
    const book = makeBookAtIndex(i, config, { attempt: 500 + t, forceBonus: t % 3 === 0 ? 4 : 3 });
    if (book.totalWin >= floor) return book;
  }
  let best = null;
  for (let t = 0; t < 250; t++) {
    const book = makeBookAtIndex(i, config, { attempt: 800 + t, forceNoBonus: true });
    if (!best || book.totalWin > best.totalWin) best = book;
  }
  return best || makeBookAtIndex(i, config, { forceBonus: 3 });
}

function makeBookAtIndexMaxWin(i, config, maxTotalWin) {
  const cap = Math.max(0, Number(maxTotalWin) || 0);
  if (cap <= 0.001) {
    return makeBookAtIndex(i, config, { forceMiss: true });
  }
  for (let t = 0; t < 500; t++) {
    const book = makeBookAtIndex(i, config, { attempt: t, forceNoBonus: true });
    if (book.totalWin > 0 && book.totalWin <= cap) return book;
  }
  let best = null;
  for (let t = 0; t < 400; t++) {
    const book = makeBookAtIndex(i, config, { attempt: 500 + t, forceNoBonus: true });
    if (book.totalWin > 0 && (!best || book.totalWin < best.totalWin)) best = book;
  }
  return best || makeBookAtIndex(i, config, { forceMiss: true });
}

function isBuyBonusConfig(config) {
  const sg = Number(config?.scatterGuarantee) || 0;
  return sg === 3 || sg === 4;
}

function adjustBooksToTargetRtp(books, config, targetRtpPct) {
  const spinCostMult = config.spinCostMult || 1;
  const buyBonus = isBuyBonusConfig(config);
  const bookCount = books.length || TOTAL_BOOKS;
  const maxPasses = 180;
  let pass = 0;
  let best = null;

  while (pass < maxPasses) {
    const metrics = computeRtpMetrics(books, spinCostMult);
    const gap = targetRtpPct - metrics.rtp;
    const absGap = Math.abs(gap);

    if (!best || absGap < best.absGap) {
      best = { absGap, metrics: { ...metrics } };
    }

    if (absGap <= RTP_ADJUST_TOLERANCE_PCT) {
      console.log(`RTP: ${metrics.rtp.toFixed(4)}% (цель ${targetRtpPct}%)`);
      return metrics;
    }

    const targetWin = (targetRtpPct / 100) * metrics.totalPaidBet;
    const deficit = targetWin - metrics.totalWin;
    const needMoreWin = deficit > 0;

    const hitCount = config.targetHitRate > 0 ? books.filter(isBookHit).length : bookCount;
    const targetAvgHitWin = hitCount > 0 ? targetWin / hitCount : 0;

    let batchSize;
    if (config.targetHitRate > 0 && hitCount > 0) {
      const perHitGap = Math.abs(deficit) / hitCount;
      batchSize = Math.min(600, Math.max(25, Math.ceil(perHitGap / Math.max(targetAvgHitWin * 0.08, 0.02))));
    } else {
      const avgWin = metrics.totalWin / bookCount || 1;
      batchSize = Math.min(3000, Math.max(100, Math.ceil(Math.abs(deficit) / Math.max(avgWin * 0.35, 0.5))));
    }

    const ranked = books
      .map((b, idx) => ({ idx, w: Number(b.totalWin), hit: isBookHit(b) }))
      .filter((x) => (config.targetHitRate > 0 ? x.hit : true))
      .sort((a, b) => (needMoreWin ? a.w - b.w : b.w - a.w));

    for (let k = 0; k < batchSize && k < ranked.length; k++) {
      const bookIdx = ranked[k].idx;
      const oldWin = ranked[k].w;
      let newBook;

      if (needMoreWin) {
        const stepUp = Math.abs(deficit) / Math.max(1, batchSize);
        const minW = Math.max(
          oldWin + 0.05,
          targetAvgHitWin * 0.2,
          Math.min(targetAvgHitWin * 1.1, oldWin + stepUp + 0.08)
        );
        newBook = makeBookAtIndexMinWin(bookIdx, config, minW);
      } else if (oldWin <= 0.001) {
        newBook = books[bookIdx];
      } else if (
        !buyBonus
        && (oldWin > targetAvgHitWin * 1.8 || k < batchSize * 0.35)
      ) {
        newBook = makeBookAtIndex(bookIdx, config, { attempt: pass * 500 + k, forceMiss: true });
      } else {
        const capW = Math.max(
          0,
          Math.min(
            oldWin * 0.55,
            targetAvgHitWin * 0.85,
            oldWin - Math.max(0.05, Math.abs(deficit) / Math.max(1, batchSize))
          )
        );
        newBook = makeBookAtIndexMaxWin(bookIdx, config, capW);
      }

      if (needMoreWin && !isBookHit(newBook)) {
        newBook = makeBookAtIndexForHitClass(bookIdx, config, true);
      }
      books[bookIdx] = newBook;
    }

    pass++;
    if (pass === 1 || pass % 20 === 0) {
      const m = computeRtpMetrics(books, spinCostMult);
      console.log(`  RTP-коррекция проход ${pass}: ${m.rtp.toFixed(4)}% (цель ${targetRtpPct}%)`);
    }
  }

  if (best) {
    console.log(`RTP: лучший результат ${best.metrics.rtp.toFixed(4)}% (цель ${targetRtpPct}%, допуск ±${RTP_ADJUST_TOLERANCE_PCT}%)`);
    return best.metrics;
  }
  const metrics = computeRtpMetrics(books, spinCostMult);
  console.warn(`RTP: не достигнута точность — ${metrics.rtp.toFixed(4)}%`);
  return metrics;
}


function encodeTorpedoMeta(bonusSpins) {
  if (!bonusSpins?.length) return '';
  const meta = bonusSpins.map((bs) => ({
    d: bs.torpedoDrops || null,
    c: !!bs.torpedoComplete,
    r: bs.torpedoResolved || null,
    w: Number(bs.win) || 0
  }));
  if (!meta.some((m) => m.d || m.c || m.r)) return '';
  return JSON.stringify(meta);
}

function applyTorpedoMeta(bonusSpins, json) {
  if (!json || !bonusSpins?.length) return;
  try {
    const meta = JSON.parse(json);
    if (!Array.isArray(meta)) return;
    for (let i = 0; i < bonusSpins.length && i < meta.length; i++) {
      const m = meta[i];
      if (!m) continue;
      if (m.d) bonusSpins[i].torpedoDrops = m.d;
      if (m.c) bonusSpins[i].torpedoComplete = true;
      if (m.r) bonusSpins[i].torpedoResolved = m.r;
      if (Number.isFinite(m.w)) bonusSpins[i].win = m.w;
    }
  } catch {
    /* ignore */
  }
}

function buildSyntheticMaxWinBook(bookId, config) {
  const scatter = Number(config.scatterGuarantee) === 3 ? 3 : 4;
  const book =
    scatter === 3
      ? buildBuy3MaxWinBook(bookId, config)
      : buildBuy4MaxWinBook(bookId, config);
  syncSpinObject(book.spin);
  for (const bs of book.bonusSpins) syncSpinObject(bs);
  if (Number(book.totalWin) < MAX_WIN_AT_BET1 * 0.99) {
    console.warn(`[JACKPOT] book ${bookId} total=${book.totalWin} < ${MAX_WIN_AT_BET1}`);
  }
  return book;
}

function buildBooksFileContent(books, metrics, config) {
  const { rtp, rtpBaseSpinOnlyPct, totalWin, totalPaidBet } = metrics;
  const hr = computeHitRateMetrics(books);
  const br = computeBonusRateMetrics(books);
  const jackpotBook = books[MAX_WIN_BOOK_ID];
  const buyBonus = isBuyBonusConfig(config);
  const scatterGuarantee = Number(config?.scatterGuarantee) || 0;
  const spinCostMult = Number(config?.spinCostMult) || 1;

  const seedLines = books.map((b) => {
    syncSpinObject(b.spin);
    for (let r = 0; r < NUM_REELS; r++) b.spin[`reel${r}`] = b.spin.reelIndices[r];

    let line = [
      b.spin.seed,
      String(Number(b.totalWin)),
      b.hasBonus ? '1' : '0',
      encodeReelsLine(b.spin),
      encodeWeightsLine(b.spin.weights),
      encodeNudgeLine(b.spin.reelNudgeMult)
    ].join('\t');

    if (b.hasBonus && b.bonusSpins?.length) {
      line += `\t${b.bonusSpins.length}`;
      for (const bs of b.bonusSpins) {
        syncSpinObject(bs);
        for (let r = 0; r < NUM_REELS; r++) bs[`reel${r}`] = bs.reelIndices[r];
        line += `\t${encodeReelsLine(bs)}\t${encodeWeightsLine(bs.weights)}\t${encodeNudgeLine(bs.reelNudgeMult)}`;
      }
      const torpMeta = encodeTorpedoMeta(b.bonusSpins);
      if (torpMeta) line += `\t${torpMeta}`;
    }
    return line;
  });

  const header = [
    '# BOOKS_XBOOT_V1',
    '# Das xBoot (Red Devil) — 6 барабанов 2-3-4-4-3-2',
    `# RTP_ALL_SEEDS: ${rtp.toFixed(4)}% (totalWin=${totalWin.toFixed(2)} totalBet=${totalPaidBet.toFixed(2)} books=${books.length})`,
    `# RTP_BASE_SPIN_ONLY: ${rtpBaseSpinOnlyPct.toFixed(4)}%`
  ];

  if (buyBonus) {
    header.push(
      `# BUY: ровно ${scatterGuarantee} scatter, платная ставка ${spinCostMult}× при bet=1 в RTP.`,
      `# BUY_SCATTER: ${scatterGuarantee}`,
      `# BUY_COST_MULT: ${spinCostMult}`,
      `# BONUS_RATE: 100% (все книги — покупка бонуса)`,
      `# PAYBACK_RATE_TARGET: 25% (totalWin >= ${spinCostMult}×)`,
      `# Префикс seed: ${config.seedIdPrefix || 'xb'}_`
    );
  } else {
    header.push(
      `# HIT_RATE: ${hr.hitRatePct.toFixed(2)}% (hit=${hr.hitCount} miss@0x=${hr.missCount})`,
      `# BONUS_RATE: ${br.bonusRatePct.toFixed(3)}% (FS triggers=${br.bonusCount}, target 1/211≈0.474%)`,
      `# MAX_WIN: ${MAX_WIN_AT_BET1}x@1 (book id ${MAX_WIN_BOOK_ID}, prob ~1/64M synthetic)`,
      `# JACKPOT_SEED: ${jackpotBook?.spin?.seed || '—'}`
    );
  }

  header.push(
    '# Колонки (TAB): seed | total_win@1 | has_bonus | reels | weights | reel_nudge_mult',
    '# [ | N | на фри: reels | weights | nudge_mult ]×N',
    '# Индексы символов: low1..target (0-14), wild4=15, xways4=16, xwild4=17'
  );

  return [...header, ...seedLines].join('\n');
}

function runGeneration() {
  const config = {
    outputFile: path.join(__dirname, 'games', 'xboot', 'books-seeds.txt'),
    seedIdPrefix: 'xb',
    spinCostMult: 1,
    targetRtp: DEFAULT_TARGET_RTP_PCT,
    targetHitRate: DEFAULT_TARGET_HIT_RATE,
    targetBonusRate: DEFAULT_TARGET_BONUS_RATE
  };

  console.log('='.repeat(60));
  console.log('Генерация книг Das xBoot →', config.outputFile);
  console.log(`Цели: RTP ${config.targetRtp}%, hit ${(config.targetHitRate * 100).toFixed(2)}%, FS ${(config.targetBonusRate * 100).toFixed(3)}%`);
  console.log('='.repeat(60));

  const books = [];
  const start = Date.now();

  for (let i = 0; i < TOTAL_BOOKS; i++) {
    if ((i + 1) % 10000 === 0) {
      const elapsed = Date.now() - start;
      console.log(`Книги: ${i + 1}/${TOTAL_BOOKS} (~${Math.round((TOTAL_BOOKS - i - 1) * (elapsed / (i + 1)) / 1000)}с осталось)`);
    }
    books.push(makeBookAtIndex(i, config));
  }

  const br0 = computeBonusRateMetrics(books);
  console.log(`\nДо подгонки: hit ${computeHitRateMetrics(books).hitRatePct.toFixed(2)}%, bonus ${br0.bonusRatePct.toFixed(3)}%, RTP ${computeRtpMetrics(books).rtp.toFixed(4)}%`);

  console.log('\nПодгонка hit rate…');
  adjustBooksToTargetHitRate(books, config, config.targetHitRate);

  let metrics = computeRtpMetrics(books);
  console.log(`\nПодгонка RTP (было ${metrics.rtp.toFixed(4)}%)…`);
  metrics = adjustBooksToTargetRtp(books, config, config.targetRtp);

  console.log('\nПодгонка FS rate (1/211)…');
  adjustBooksToTargetBonusRate(books, config, config.targetBonusRate);

  console.log('\nКоррекция hit после FS…');
  adjustBooksToTargetHitRate(books, config, config.targetHitRate);

  metrics = computeRtpMetrics(books);
  console.log(`\nФинальная подгонка RTP (сейчас ${metrics.rtp.toFixed(4)}%)…`);
  metrics = adjustBooksToTargetRtp(books, config, config.targetRtp);

  books[MAX_WIN_BOOK_ID] = buildSyntheticMaxWinBook(MAX_WIN_BOOK_ID, config);
  metrics = computeRtpMetrics(books);

  const outDir = path.dirname(config.outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(config.outputFile, buildBooksFileContent(books, metrics, config));

  const hr = computeHitRateMetrics(books);
  const br = computeBonusRateMetrics(books);
  console.log('\n' + '='.repeat(60));
  console.log('Готово:', config.outputFile);
  console.log(`RTP: ${metrics.rtp.toFixed(4)}% | Hit: ${hr.hitRatePct.toFixed(2)}% | FS: ${br.bonusRatePct.toFixed(3)}%`);
  console.log(`Джекпот: id=${MAX_WIN_BOOK_ID} seed=${books[MAX_WIN_BOOK_ID]?.spin?.seed} win=${books[MAX_WIN_BOOK_ID]?.totalWin}`);
  console.log(`Время: ${((Date.now() - start) / 1000).toFixed(1)}с`);
  console.log('='.repeat(60));
}

if (require.main === module) {
  runGeneration();
}

module.exports = {
  runGeneration,
  makeBookAtIndex,
  makeBookAtIndexMinWin,
  buildSyntheticMaxWinBook,
  encodeTorpedoMeta,
  applyTorpedoMeta,
  computeRtpMetrics,
  computeHitRateMetrics,
  computeBonusRateMetrics,
  adjustBooksToTargetRtp,
  adjustBooksToTargetHitRate,
  adjustBooksToTargetBonusRate,
  buildBooksFileContent,
  syncSpinObject,
  isBuyBonusConfig,
  TOTAL_BOOKS,
  DEFAULT_TARGET_RTP_PCT,
  DEFAULT_TARGET_HIT_RATE,
  DEFAULT_TARGET_BONUS_RATE,
  MAX_WIN_BOOK_ID,
  MAX_WIN_AT_BET1
};
