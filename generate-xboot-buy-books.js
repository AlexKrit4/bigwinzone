'use strict';

/**
 * Книги покупки бонуса Das xBoot: 3 scatter (75×) и 4 scatter (350×).
 */

const fs = require('fs');
const path = require('path');

const {
  makeBookAtIndex,
  computeRtpMetrics,
  buildBooksFileContent,
  DEFAULT_TARGET_RTP_PCT,
  isBuyBonusConfig
} = require('./generate-xboot-books.js');

/** Быстрая подгонка RTP покупки: масштаб bonusWin без пересимуляции досок. */
function scaleBuyBooksToTargetRtp(books, spinCostMult, targetRtpPct) {
  let metrics = computeRtpMetrics(books, spinCostMult);
  const targetWin = (targetRtpPct / 100) * metrics.totalPaidBet;
  if (metrics.totalWin <= 0 || targetWin <= 0) return metrics;

  const scale = targetWin / metrics.totalWin;
  for (const book of books) {
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

const TOTAL_BUY_BOOKS = 5000;
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

  const metrics = scaleBuyBooksToTargetRtp(books, config.spinCostMult, config.targetRtp);
  console.log(`После подгонки RTP: ${metrics.rtp.toFixed(4)}%`);

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
