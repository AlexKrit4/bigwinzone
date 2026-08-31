#!/usr/bin/env node
'use strict';

const { buildSyntheticMaxWinBook } = require('../jackpot-boards.js');
const { MAX_WIN_AT_BET1 } = require('../jackpot-boards.js');

const SITE = process.env.SITE_URL || 'http://31.76.245.81:8080';

function replayUrl({ seed, bookIndex, scatterBuy, bet = 1, win = MAX_WIN_AT_BET1 }) {
  const mult = win / bet;
  const params = new URLSearchParams({
    embed: '1',
    replay: '1',
    bet: String(bet),
    win: String(win),
    mult: String(mult),
    scatter: String(scatterBuy || 0)
  });
  if (seed) params.set('seed', seed);
  else if (bookIndex != null) params.set('index', String(bookIndex));
  return `${SITE}/slot/games/xboot/index.html?${params.toString()}`;
}

const specs = [
  {
    label: 'Обычная игра (base)',
    bookId: 5_000_000,
    config: { seedIdPrefix: 'xb', scatterCount: 4 },
    scatterBuy: 0,
    bet: 1
  },
  {
    label: 'Покупка 3 scatter',
    bookId: 99_999,
    config: { seedIdPrefix: 'xbb3', scatterCount: 3, scatterGuarantee: 3 },
    scatterBuy: 3,
    bet: 1
  },
  {
    label: 'Покупка 4 scatter',
    bookId: 99_999,
    config: { seedIdPrefix: 'xbb4', scatterCount: 4, scatterGuarantee: 4 },
    scatterBuy: 4,
    bet: 1
  }
];

console.log('Максвин-книги (55 200× @ bet=1)\n');

for (const spec of specs) {
  const book = buildSyntheticMaxWinBook(spec.bookId, spec.config);
  const effectiveBet = spec.scatterBuy === 3 ? 75 : spec.scatterBuy === 4 ? 350 : 1;
  const url = replayUrl({
    seed: book.spin.seed,
    bookIndex: spec.scatterBuy === 0 ? spec.bookId : undefined,
    scatterBuy: spec.scatterBuy,
    bet: effectiveBet,
    win: book.totalWin * effectiveBet
  });
  console.log(`${spec.label}`);
  console.log(`  id: ${spec.bookId}`);
  console.log(`  seed: ${book.spin.seed}`);
  console.log(`  totalWin@1: ${book.totalWin}`);
  console.log(`  replay: ${url}`);
  console.log('');
}
