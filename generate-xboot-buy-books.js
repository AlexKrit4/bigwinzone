'use strict';

/**
 * Книги покупки бонуса Das xBoot: 3 scatter (75×) и 4 scatter (350×).
 */

const fs = require('fs');
const path = require('path');

const {
  makeBookAtIndex,
  makeBookAtIndexMinWin,
  computeRtpMetrics,
  buildBooksFileContent,
  buildSyntheticMaxWinBook,
  DEFAULT_TARGET_RTP_PCT,
  isBuyBonusConfig,
  MAX_WIN_BOOK_ID
} = require('./generate-xboot-books.js');

function scaleBuyBooksToTargetRtp(books, spinCostMult, targetRtpPct, jackpotId = MAX_WIN_BOOK_ID) {
  let metrics = computeRtpMetrics(books, spinCostMult);
  const targetWin = (targetRtpPct / 100) * metrics.totalPaidBet;
  if (metrics.totalWin <= 0 || targetWin <= 0) return metrics;

  const scale = targetWin / metrics.totalWin;
  for (let i = 0; i < books.length; i++) {
    if (i === jackpotId) continue;
    const book = books[i];
    const baseWin = Number(book.spin?.win) || 0;
    const bonusWin = Number(book.bonusWin);
    const bonusPart = Number.isFinite(bonusWin)
      ? bonusWin
      : Math.max(0, Number(book.totalWin) - baseWin);
    const newBonus = Math.max(0, bonusPart * scale);
    book.bonusWin = newBonus;
    book.totalWin = baseWin + newBonus;
    book.totalWinMultiplier = book.totalWin;
  }

  return computeRtpMetrics(books, spinCostMult);
}

function boostBookToMinTotal(book, minTotalWin) {
  const floor = Math.max(0, Number(minTotalWin) || 0);
  const baseWin = Number(book.spin?.win) || 0;
  if (Number(book.totalWin) >= floor) return false;
  const bonusWin = Math.max(0, floor - baseWin);
  book.bonusWin = bonusWin;
  book.totalWin = baseWin + bonusWin;
  book.totalWinMultiplier = book.totalWin;
  return true;
}

function balanceBuy3RtpAndPayback(books, config, targetPct = 0.25) {
  const cost = config.spinCostMult;
  const targetRtp = config.targetRtp;
  const targetCount = Math.round(books.length * targetPct);
  const paybackFloor = cost + 0.5;

  scaleBuyBooksToTargetRtp(books, cost, targetRtp);
  console.log(`После начальной подгонки RTP: ${computeRtpMetrics(books, cost).rtp.toFixed(4)}%`);

  const ranked = books
    .map((b, idx) => ({ idx, w: Number(b.totalWin) }))
    .filter((x) => x.idx !== MAX_WIN_BOOK_ID)
    .sort((a, b) => b.w - a.w);
  const paybackSet = new Set(ranked.slice(0, targetCount).map((x) => x.idx));

  let boosted = 0;
  for (const idx of paybackSet) {
    if (boostBookToMinTotal(books[idx], paybackFloor)) boosted++;
  }
  console.log(`Payback: топ-${targetCount} книг, boost ${boosted} до >= ${paybackFloor}×`);

  for (let iter = 0; iter < 40; iter++) {
    const m = computeRtpMetrics(books, cost);
    if (Math.abs(m.rtp - targetRtp) <= 0.45) break;

    const targetTotalWin = (targetRtp / 100) * m.totalPaidBet;
    let paybackWin = 0;
    let nonPaybackWin = 0;
    for (let i = 0; i < books.length; i++) {
      if (i === MAX_WIN_BOOK_ID) continue;
      const tw = Number(books[i].totalWin) || 0;
      if (paybackSet.has(i)) paybackWin += tw;
      else nonPaybackWin += tw;
    }

    const desiredNonPayback = targetTotalWin - paybackWin;
    if (nonPaybackWin <= 0 || desiredNonPayback <= 0) break;
    const scale = desiredNonPayback / nonPaybackWin;

    for (let i = 0; i < books.length; i++) {
      if (i === MAX_WIN_BOOK_ID || paybackSet.has(i)) continue;
      const book = books[i];
      const baseWin = Number(book.spin?.win) || 0;
      const bonusPart = Math.max(0, Number(book.totalWin) - baseWin);
      const newBonus = Math.max(0, bonusPart * scale);
      book.bonusWin = newBonus;
      book.totalWin = baseWin + newBonus;
      book.totalWinMultiplier = book.totalWin;
    }
  }

  const payback = books.filter((b, i) => i !== MAX_WIN_BOOK_ID && Number(b.totalWin) >= cost).length;
  const rtp = computeRtpMetrics(books, cost).rtp;
  console.log(`Payback >= ${cost}×: ${payback}/${books.length} (${((payback / books.length) * 100).toFixed(1)}%)`);
  console.log(`После баланса RTP/payback: ${rtp.toFixed(4)}%`);
  return { payback, rtp };
}

const TOTAL_BUY_BOOKS = 100_000;
const BUY_SCATTER3_COST_MULT = 75;
const BUY_SCATTER4_COST_MULT = 350;

const XBOOT_DIR = path.join(__dirname, 'games', 'xboot');

const BUY_CONFIGS = {
  buy3: {
    outputFile: path.join(XBOOT_DIR, 'books-seeds-buy-scatter3.txt'),
    scatterGuarantee: 3,
    seedIdPrefix: 'xbb3',
    spinCostMult: BUY_SCATTER3_COST_MULT,
    label: 'покупка бонуса 3 scatter (75×)'
  },
  buy4: {
    outputFile: path.join(XBOOT_DIR, 'books-seeds-buy-scatter4.txt'),
    scatterGuarantee: 4,
    seedIdPrefix: 'xbb4',
    spinCostMult: BUY_SCATTER4_COST_MULT,
    label: 'покупка бонуса 4 scatter (350×)'
  }
};

function runBuyBooksGeneration(buyKey) {
  const spec = BUY_CONFIGS[buyKey];
  if (!spec) throw new Error(`unknown buy key: ${buyKey}`);

  const config = {
    ...spec,
    targetRtp: DEFAULT_TARGET_RTP_PCT,
    targetHitRate: 0,
    targetBonusRate: 0
  };

  if (!isBuyBonusConfig(config)) {
    throw new Error('invalid buy config');
  }

  console.log('='.repeat(60));
  console.log(`Генерация книг xBoot: ${config.label}`);
  console.log(`→ ${config.outputFile}`);
  console.log(`Книг: ${TOTAL_BUY_BOOKS}, RTP цель: ${config.targetRtp}%`);
  console.log('='.repeat(60));

  const books = [];
  const start = Date.now();

  for (let i = 0; i < TOTAL_BUY_BOOKS; i++) {
    if ((i + 1) % 2500 === 0) {
      console.log(`  ${i + 1}/${TOTAL_BUY_BOOKS}`);
    }
    books.push(makeBookAtIndex(i, config));
  }

  const before = computeRtpMetrics(books, config.spinCostMult);
  console.log(`\nДо подгонки RTP: ${before.rtp.toFixed(4)}%`);

  let metrics;
  if (buyKey === 'buy3') {
    balanceBuy3RtpAndPayback(books, config, 0.25);
    metrics = computeRtpMetrics(books, config.spinCostMult);
  } else {
    metrics = scaleBuyBooksToTargetRtp(books, config.spinCostMult, config.targetRtp);
    console.log(`После подгонки RTP: ${metrics.rtp.toFixed(4)}%`);
  }

  books[MAX_WIN_BOOK_ID] = buildSyntheticMaxWinBook(MAX_WIN_BOOK_ID, config);
  metrics = computeRtpMetrics(books, config.spinCostMult);

  const jackpot = books[MAX_WIN_BOOK_ID];
  console.log(`Максвин: id=${MAX_WIN_BOOK_ID} seed=${jackpot?.spin?.seed} total=${jackpot?.totalWin}`);

  const outDir = path.dirname(config.outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(config.outputFile, buildBooksFileContent(books, metrics, config));

  const bonusCount = books.filter((b) => b.hasBonus).length;
  const avgWin = books.reduce((s, b) => s + Number(b.totalWin), 0) / books.length;

  console.log('\n' + '='.repeat(60));
  console.log('Готово:', config.outputFile);
  console.log(`RTP: ${metrics.rtp.toFixed(4)}% | бонус-книг: ${bonusCount}/${books.length}`);
  console.log(`Средний total_win@1: ${avgWin.toFixed(2)}×`);
  console.log(`Время: ${((Date.now() - start) / 1000).toFixed(1)}с`);
  console.log('='.repeat(60));

  return metrics;
}

function runAll() {
  runBuyBooksGeneration('buy3');
  runBuyBooksGeneration('buy4');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--buy-scatter4')) {
    runBuyBooksGeneration('buy4');
  } else if (argv.includes('--buy-scatter3')) {
    runBuyBooksGeneration('buy3');
  } else {
    runAll();
  }
}

module.exports = {
  TOTAL_BUY_BOOKS,
  BUY_SCATTER3_COST_MULT,
  BUY_SCATTER4_COST_MULT,
  runBuyBooksGeneration,
  runAll
};
