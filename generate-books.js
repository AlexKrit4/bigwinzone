// Генератор 100,000 книг спинов

/** Должны совпадать со slot.js (RNG книги = RNG слота) */
const XWAYS_REDUCTION_FACTOR = 10;
const WILD_REDUCTION_FACTOR = 6;
const SCATTER_WEIGHT = 0.2489393146;

const SYMBOLS = ['low1', 'low2', 'low3', 'low4', 'low5', 'high1', 'high2', 'high3', 'high4', 'high5', 'wild', 'scatter', 'xWays', 'split', 'split_wilds'];

const {
    simulateBonusGame,
    simulateBaseSpinOutcome,
    buildMinimalBonusSpin,
    buildSyntheticMaxWinBonusSpin
} = require('./bonus-slot-sim.js');

// ОРИГИНАЛЬНАЯ ТАБЛИЦА ВЫПЛАТ - БЕЗ ПОДГОНКИ
const PAYOUTS = {
    'low1': { 3: 0.1, 4: 0.2, 5: 0.5 },
    'low2': { 3: 0.1, 4: 0.2, 5: 0.6 },
    'low3': { 3: 0.1, 4: 0.2, 5: 0.7 },
    'low4': { 3: 0.2, 4: 0.3, 5: 0.8 },
    'low5': { 3: 0.2, 4: 0.3, 5: 0.9 },
    'high1': { 3: 0.3, 4: 0.4, 5: 1.0 },
    'high2': { 3: 0.3, 4: 0.4, 5: 1.5 },
    'high3': { 3: 0.4, 4: 0.5, 5: 2.5 },
    'high4': { 3: 0.4, 4: 0.6, 5: 3.0 },
    'high5': { 3: 0.5, 4: 0.75, 5: 6.0 }
};

const NUM_REELS = 5;
const VISIBLE_ROWS = 3;

/**
 * Компактный детерминированный seed исхода спина для аудита / интеграции.
 * tag: 0 — базовый спин книги; 1..N — номер фри-спина (чтобы одинаковая сетка не давала тот же seed).
 */
function makeSpinSeed(bookId, tag, namesGrid, weightsGrid, seedIdPrefix = 'rv') {
    const parts = [Number(bookId), Number(tag) || 0];
    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            parts.push(SYMBOLS.indexOf(namesGrid[reel][row]));
            parts.push(weightsGrid[reel][row]);
        }
    }
    let h = 5381 >>> 0;
    for (const n of parts) {
        h = ((h << 5) + h + (Number(n) | 0)) >>> 0;
    }
    const lo = (h >>> 0).toString(36);
    const idPart = Number(bookId).toString(36);
    return `${seedIdPrefix}_${idPart}_${lo}`;
}

function winMultiplier(winAmount, baseBet = 1) {
    const b = Number(baseBet) || 1;
    const w = Number(winAmount) || 0;
    if (!(b > 0)) return w;
    return w / b;
}

function getRandomSymbolIndex(omitScatter = false) {
    const weights = SYMBOLS.map((name) => {
        if (name === 'split' || name === 'split_wilds') return 0;
        if (omitScatter && name === 'scatter') return 0;
        if (name === 'xWays') return 1 / XWAYS_REDUCTION_FACTOR;
        if (name === 'wild') return 1 / WILD_REDUCTION_FACTOR;
        if (name === 'scatter') return SCATTER_WEIGHT;
        return 1;
    });

    const total = weights.reduce((acc, v) => acc + v, 0);
    if (!(total > 0)) return 0;
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

/** Как slot.js generateResult (только базовая игра, без бонуса на барабанах). */
function generateSpinIndices(scatterGuarantee = 0) {
    const scatterIndex = SYMBOLS.indexOf('scatter');

    const pickRandomNonScatterIndex = () => {
        for (let attempts = 0; attempts < 40; attempts++) {
            const idx = getRandomSymbolIndex(true);
            if (idx !== scatterIndex) return idx;
        }
        for (let i = 0; i < SYMBOLS.length; i++) {
            if (i !== scatterIndex) return i;
        }
        return 0;
    };

    const result = [];

    for (let reel = 0; reel < NUM_REELS; reel++) {
        const reelSymbols = [];
        let scatterUsed = false;

        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const allowScatterByWeights = scatterGuarantee === 0 || scatterGuarantee === 1;
            let idx = allowScatterByWeights ? getRandomSymbolIndex(false) : pickRandomNonScatterIndex();

            if (scatterIndex >= 0 && idx === scatterIndex) {
                if (scatterUsed) {
                    idx = pickRandomNonScatterIndex();
                } else {
                    scatterUsed = true;
                }
            }

            reelSymbols.push(idx);
        }

        result.push(reelSymbols);
    }

    if (scatterGuarantee > 0 && scatterIndex >= 0) {
        if (scatterGuarantee === 1) {
            const forcedReel = 1;
            const forcedRow = 1;
            result[forcedReel][forcedRow] = scatterIndex;
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (row === forcedRow) continue;
                if (result[forcedReel][row] === scatterIndex) {
                    result[forcedReel][row] = pickRandomNonScatterIndex();
                }
            }
        } else {
            const count = Math.min(NUM_REELS, Math.max(0, Math.floor(scatterGuarantee)));
            const reels = [0, 1, 2, 3, 4];
            for (let i = reels.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [reels[i], reels[j]] = [reels[j], reels[i]];
            }
            const pickedReels = reels.slice(0, count);
            for (const r of pickedReels) {
                const row = Math.floor(Math.random() * VISIBLE_ROWS);
                result[r][row] = scatterIndex;
            }
        }
    }

    return result;
}

function calculateWin(bet, namesGrid, weightsGrid) {
    let totalWin = 0;
    const payableSymbols = Object.keys(PAYOUTS);

    for (const targetSymbol of payableSymbols) {
        const symbolCounts = [];

        for (let reel = 0; reel < NUM_REELS; reel++) {
            let count = 0;
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                const cell = namesGrid[reel][row];
                if (cell === targetSymbol || cell === 'wild' || cell === 'split_wilds') {
                    count += (weightsGrid?.[reel]?.[row] || 1);
                }
            }
            symbolCounts.push(count);
        }

        // Ищем максимальную последовательность слева направо
        let maxLength = 0;
        for (let len = NUM_REELS; len >= 3; len--) {
            let hasSequence = true;
            for (let i = 0; i < len; i++) {
                if (symbolCounts[i] === 0) {
                    hasSequence = false;
                    break;
                }
            }
            if (hasSequence) {
                maxLength = len;
                break;
            }
        }

        if (maxLength >= 3) {
            let ways = 1;
            for (let i = 0; i < maxLength; i++) {
                ways *= symbolCounts[i];
            }

            const multiplier = PAYOUTS[targetSymbol]?.[maxLength];
            if (!multiplier) continue;
            
            const win = bet * multiplier * ways;
            totalWin += win;
        }
    }

    return totalWin;
}

// Подсчет скаттеров на поле
function countScatters(namesGrid) {
    let count = 0;
    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (namesGrid[reel][row] === 'scatter') count++;
        }
    }
    return count;
}

/** Контекст для bonus-slot-sim.js (та же цепочка resolve, что в slot.js) */
const SLOT_SIM_CTX = {
    SYMBOLS,
    NUM_REELS,
    VISIBLE_ROWS,
    PAYOUTS,
    SCATTER_WEIGHT,
    XWAYS_REDUCTION_FACTOR,
    WILD_REDUCTION_FACTOR,
    calculateWin,
    winMultiplier,
    makeSpinSeed
};

const fs = require('fs');
const TOTAL_BOOKS = 100000;
const DEFAULT_TARGET_RTP_PCT = 96;
const RTP_ADJUST_TOLERANCE_PCT = 0.05;
/** Доля спинов с выплатой > 0 (остальные — 0× на весь seed). */
const DEFAULT_TARGET_HIT_RATE = 0.26;
const HIT_RATE_TOLERANCE = 0;

/** Покупка бонуса: разнообразные total_win@1 (как у базовых спинов), RTP 96%, 1 джекпот-сид. */
const BUY_EXTREME_MAX_WIN_BOOK_ID = 77777;
const BUY_EXTREME_MAX_WIN_AT_BET1 = 41500;
const BUY_VARIED_POOL_MIN_PER_BUCKET = 350;
const BUY_VARIED_POOL_MAX_ATTEMPTS = 400000;

function encodeReelsLine(spin, reelKeyPrefix = 'reel') {
    const parts = [];
    for (let r = 0; r < NUM_REELS; r++) {
        parts.push(spin[`${reelKeyPrefix}${r}`].join(','));
    }
    return parts.join('|');
}

function encodeWeightsLine(weightsGrid) {
    const parts = [];
    for (let r = 0; r < NUM_REELS; r++) {
        parts.push(weightsGrid[r].join(','));
    }
    return parts.join('|');
}

function computeRtpMetrics(books, spinCostMult, capPayoutAtBet1 = 0) {
    const totalPaidBet = TOTAL_BOOKS * spinCostMult;
    const cap = Number(capPayoutAtBet1) > 0 ? Number(capPayoutAtBet1) : 0;
    const payout = (b) => {
        const w = Number(b.totalWin) || 0;
        return cap > 0 ? Math.min(w, cap) : w;
    };
    const totalWin = books.reduce((s, b) => s + payout(b), 0);
    const sumBaseWin = books.reduce((s, b) => s + Number(b.spin.win), 0);
    const rtp = totalPaidBet > 0 ? (totalWin / totalPaidBet) * 100 : 0;
    const rtpBaseSpinOnlyPct = totalPaidBet > 0 ? (sumBaseWin / totalPaidBet) * 100 : 0;
    return { totalPaidBet, totalWin, sumBaseWin, rtp, rtpBaseSpinOnlyPct };
}

const MOD1_FORCED_REEL = 1;
const MOD1_FORCED_ROW = 1;

function namesGridFromSpinRecord(spin) {
    return Array.from({ length: NUM_REELS }, (_, r) =>
        Array.from({ length: VISIBLE_ROWS }, (_, row) => SYMBOLS[spin[`reel${r}`][row]])
    );
}

function syncSpinRecordFromNamesGrid(spin, namesGrid, weightsGrid) {
    for (let r = 0; r < NUM_REELS; r++) {
        spin[`reel${r}`] = namesGrid[r].map((s) => SYMBOLS.indexOf(s));
        spin.weights[r] = weightsGrid[r].map((w) => Number(w) || 1);
    }
}

/** mod×1: в файле всегда scatter на 2-м барабане (индекс 1), центральный ряд. */
function enforceMod1CenterScatterOnBook(book, config) {
    if (config.scatterGuarantee !== 1) return book;

    const scatterIx = SYMBOLS.indexOf('scatter');
    if (scatterIx < 0) return book;

    const namesGrid = namesGridFromSpinRecord(book.spin);
    const weightsGrid = book.spin.weights.map((row) => [...row]);

    namesGrid[MOD1_FORCED_REEL][MOD1_FORCED_ROW] = 'scatter';
    for (let row = 0; row < VISIBLE_ROWS; row++) {
        if (row !== MOD1_FORCED_ROW && namesGrid[MOD1_FORCED_REEL][row] === 'scatter') {
            namesGrid[MOD1_FORCED_REEL][row] = 'low1';
        }
    }

    syncSpinRecordFromNamesGrid(book.spin, namesGrid, weightsGrid);

    const win = calculateWin(1, namesGrid, weightsGrid);
    book.spin.win = win;
    book.spin.winMultiplier = winMultiplier(win, 1);
    book.scatterCount = countScatters(namesGrid);
    book.spin.seed = makeSpinSeed(book.id, 0, namesGrid, weightsGrid, config.seedIdPrefix);
    book.seed = book.spin.seed;

    if (book.hasBonus && book.bonusWin != null) {
        book.totalWin = win + Number(book.bonusWin);
    } else {
        book.hasBonus = false;
        book.bonusSpins = [];
        book.bonusWin = 0;
        book.totalWin = win;
    }
    book.totalWinMultiplier = winMultiplier(book.totalWin, 1);
    return book;
}

function countMod1CenterScatterViolations(books) {
    const scatterIx = SYMBOLS.indexOf('scatter');
    let bad = 0;
    for (const book of books) {
        const r1 = book.spin?.reel1;
        if (!r1 || r1[MOD1_FORCED_ROW] !== scatterIx) bad++;
    }
    return bad;
}

function enforceMod1OnAllBooks(books, config) {
    for (let i = 0; i < books.length; i++) {
        books[i] = enforceMod1CenterScatterOnBook(books[i], config);
    }
    return books;
}

/** Одна книга (базовый спин + опционально полный бонус). */
function makeBookAtIndex(i, config) {
    const {
        scatterGuarantee = 0,
        seedIdPrefix = 'rv'
    } = config;
    const payoutBet = 1.0;

    let spin;
    let namesGrid;
    let weightsGrid;
    let scatterCount;
    do {
        spin = generateSpinIndices(scatterGuarantee);
        ({ namesGrid, weightsGrid } = simulateBaseSpinOutcome(spin, SLOT_SIM_CTX, {
            forceScatterReel1Center: scatterGuarantee === 1
        }));
        scatterCount = countScatters(namesGrid);
    } while (
        (scatterGuarantee === 3 || scatterGuarantee === 4 || scatterGuarantee === 5)
        && scatterCount !== scatterGuarantee
    );

    const win = calculateWin(payoutBet, namesGrid, weightsGrid);
    const baseSpinSeed = makeSpinSeed(i, 0, namesGrid, weightsGrid, seedIdPrefix);

    const book = {
        id: i,
        seed: baseSpinSeed,
        baseWinMultiplier: winMultiplier(win, payoutBet),
        totalWinMultiplier: winMultiplier(win, payoutBet),
        hasBonus: false,
        scatterCount,
        spin: {
            seed: baseSpinSeed,
            winMultiplier: winMultiplier(win, payoutBet),
            reel0: namesGrid[0].map((s) => SYMBOLS.indexOf(s)),
            reel1: namesGrid[1].map((s) => SYMBOLS.indexOf(s)),
            reel2: namesGrid[2].map((s) => SYMBOLS.indexOf(s)),
            reel3: namesGrid[3].map((s) => SYMBOLS.indexOf(s)),
            reel4: namesGrid[4].map((s) => SYMBOLS.indexOf(s)),
            weights: weightsGrid,
            win
        },
        totalWin: win
    };

    if (scatterCount >= 3) {
        const { bonusSpins, totalBonusWin } = simulateBonusGame(scatterCount, i, {
            ...SLOT_SIM_CTX,
            makeSpinSeed: (bookId, tag, ng, wg) => makeSpinSeed(bookId, tag, ng, wg, seedIdPrefix)
        });

        book.hasBonus = true;
        book.bonusSpins = bonusSpins;
        book.bonusWin = totalBonusWin;
        book.totalWin = win + totalBonusWin;
        book.totalWinMultiplier = winMultiplier(book.totalWin, payoutBet);
    }

    return enforceMod1CenterScatterOnBook(book, config);
}

function cloneBookToIndex(source, newId, config) {
    const book = JSON.parse(JSON.stringify(source));
    book.id = newId;

    const baseNg = namesGridFromSpinRecord(book.spin);
    const baseWg = book.spin.weights.map((row) => [...row]);
    book.spin.seed = makeSpinSeed(newId, 0, baseNg, baseWg, config.seedIdPrefix);
    book.seed = book.spin.seed;

    if (Array.isArray(book.bonusSpins)) {
        for (let bi = 0; bi < book.bonusSpins.length; bi++) {
            const bs = book.bonusSpins[bi];
            const bNg = namesGridFromSpinRecord(bs);
            const bWg = bs.weights.map((row) => [...row]);
            bs.seed = makeSpinSeed(newId, bi + 1, bNg, bWg, config.seedIdPrefix);
        }
    }

    return book;
}

/** Подбор книги с total_win@1 в диапазоне [minWin, maxWin]. */
function makeBookInWinRange(bookId, config, minWin, maxWin, maxAttempts = 12000) {
    let best = null;
    let bestDist = Infinity;

    for (let t = 0; t < maxAttempts; t++) {
        const book = makeBookAtIndex(bookId, config);
        if (!book.hasBonus) continue;

        const w = Number(book.totalWin);
        if (w >= minWin && w <= maxWin) {
            return book;
        }

        const dist = w < minWin ? minWin - w : w - maxWin;
        if (dist < bestDist) {
            bestDist = dist;
            best = book;
        }
    }

    return best || makeBookAtIndex(bookId, config);
}

/**
 * Целевые доли total_win@1 по корзинам (как у базовых книг: много мелких, редкие крупные).
 * Доли нормализуются; джекпот — отдельно id=BUY_EXTREME_MAX_WIN_BOOK_ID.
 */
function getBuyVariedBucketDefs(spinCostMult) {
    const cost = Number(spinCostMult) || 68;
    const raw = [
        { id: 'zero', label: '0×', min: 0, max: 0, frac: 0.08 },
        { id: 't0_1', label: '(0; 1.1×]', min: 0, max: 1.1, frac: 0.12 },
        { id: 't1_2', label: '(1.1; 2×]', min: 1.1, max: 2, frac: 0.06 },
        { id: 't2_5', label: '(2; 5×]', min: 2, max: 5, frac: 0.08 },
        { id: 't5_10', label: '(5; 10×]', min: 5, max: 10, frac: 0.12 },
        { id: 't10_20', label: '(10; 20×]', min: 10, max: 20, frac: 0.38 },
        { id: 't20_50', label: '(20; 50×]', min: 20, max: 50, frac: 0.12 },
        { id: 't50_pre', label: `(50; ${Math.min(100, cost)}×]`, min: 50, max: Math.min(100, cost), frac: 0.05 },
        { id: 't100_500', label: '(100; 500×]', min: 100, max: 500, frac: cost > 100 ? 0.04 : 0 },
        { id: 't500_cost', label: `(500; ${cost}×]`, min: 500, max: cost, frac: cost > 500 ? 0.03 : 0 },
        { id: 'profit1', label: `(${cost}; ${Math.round(cost * 2.5)}×]`, min: cost, max: cost * 2.5, frac: 0.012 },
        { id: 'profit2', label: `(${Math.round(cost * 2.5)}; ${Math.round(cost * 8)}×]`, min: cost * 2.5, max: cost * 8, frac: 0.006 },
        { id: 'profit3', label: `(${Math.round(cost * 8)}; 2500×]`, min: cost * 8, max: 2500, frac: 0.003 },
        { id: 'profit4', label: '(2500; 8000×]', min: 2500, max: 8000, frac: 0.001 },
        { id: 'profit5', label: '(8000; 41500×)', min: 8000, max: BUY_EXTREME_MAX_WIN_AT_BET1 - 0.01, frac: 0.001 }
    ].filter((b) => b.frac > 0 && (b.id === 'zero' || b.max > b.min));

    const sum = raw.reduce((s, b) => s + b.frac, 0);
    return raw.map((b) => ({ ...b, frac: b.frac / sum }));
}

function bookMatchesBuyBucket(win, bucket) {
    const w = Number(win) || 0;
    if (bucket.id === 'zero') return w === 0;
    if (w <= 0) return false;
    if (bucket.id === 't0_1') return w > 0 && w <= bucket.max;
    return w > bucket.min && w <= bucket.max;
}

function classifyBookBuyBucket(win, bucketDefs) {
    for (const b of bucketDefs) {
        if (bookMatchesBuyBucket(win, b)) return b.id;
    }
    return null;
}

function collectBuyVariedPools(config, bucketDefs, onProgress) {
    const pools = Object.fromEntries(bucketDefs.map((b) => [b.id, []]));
    const need = BUY_VARIED_POOL_MIN_PER_BUCKET;

    for (let attempt = 0; attempt < BUY_VARIED_POOL_MAX_ATTEMPTS; attempt++) {
        if (attempt > 0 && attempt % 80000 === 0) {
            const filled = bucketDefs.map((b) => `${b.id}=${pools[b.id].length}`).join(' ');
            onProgress?.(attempt, filled);
        }

        const book = makeBookAtIndex(attempt + 300000, config);
        if (!book.hasBonus) continue;

        const w = Number(book.totalWin);
        if (w >= BUY_EXTREME_MAX_WIN_AT_BET1) continue;

        const bucketId = classifyBookBuyBucket(w, bucketDefs);
        if (!bucketId || pools[bucketId].length >= need) continue;

        pools[bucketId].push(book);

        const allFull = bucketDefs.every((b) => pools[b.id].length >= need);
        if (allFull) break;
    }

    return pools;
}

/** Джекпот-книга: синтетический фри со столбцами xWays + split → high5 (total_win ≥ 41500). */
function buildSyntheticJackpotBook(bookId, config) {
    const { scatterGuarantee, seedIdPrefix } = config;
    const bonusSpinsNeeded = { 3: 7, 4: 8, 5: 10 }[scatterGuarantee] || 7;
    const simCtx = {
        ...SLOT_SIM_CTX,
        makeSpinSeed: (bId, tag, ng, wg) => makeSpinSeed(bId, tag, ng, wg, seedIdPrefix)
    };

    let namesGrid;
    let weightsGrid;
    let scatterCount = 0;
    for (let t = 0; t < 800; t++) {
        const spin = generateSpinIndices(scatterGuarantee);
        ({ namesGrid, weightsGrid } = simulateBaseSpinOutcome(spin, SLOT_SIM_CTX));
        scatterCount = countScatters(namesGrid);
        if (scatterCount === scatterGuarantee) break;
    }

    const baseWin = calculateWin(1, namesGrid, weightsGrid);
    const baseSpinSeed = makeSpinSeed(bookId, 0, namesGrid, weightsGrid, seedIdPrefix);
    const bonusSpins = [];
    let totalBonusWin = 0;

    for (let s = 0; s < bonusSpinsNeeded; s++) {
        if (s === bonusSpinsNeeded - 1) {
            const { spinRecord, bonusWin } = buildSyntheticMaxWinBonusSpin(
                scatterGuarantee,
                bookId,
                s,
                simCtx,
                BUY_EXTREME_MAX_WIN_AT_BET1
            );
            bonusSpins.push(spinRecord);
            totalBonusWin += bonusWin;
        } else {
            const { spinRecord, bonusWin } = buildMinimalBonusSpin(
                scatterGuarantee,
                bookId,
                s,
                simCtx
            );
            bonusSpins.push(spinRecord);
            totalBonusWin += bonusWin;
        }
    }

    const book = {
        id: bookId,
        seed: baseSpinSeed,
        baseWinMultiplier: winMultiplier(baseWin, 1),
        totalWinMultiplier: winMultiplier(baseWin + totalBonusWin, 1),
        hasBonus: true,
        scatterCount,
        spin: {
            seed: baseSpinSeed,
            winMultiplier: winMultiplier(baseWin, 1),
            reel0: namesGrid[0].map((s) => SYMBOLS.indexOf(s)),
            reel1: namesGrid[1].map((s) => SYMBOLS.indexOf(s)),
            reel2: namesGrid[2].map((s) => SYMBOLS.indexOf(s)),
            reel3: namesGrid[3].map((s) => SYMBOLS.indexOf(s)),
            reel4: namesGrid[4].map((s) => SYMBOLS.indexOf(s)),
            weights: weightsGrid,
            win: baseWin
        },
        bonusSpins,
        bonusWin: totalBonusWin,
        totalWin: baseWin + totalBonusWin
    };
    book.totalWinMultiplier = winMultiplier(book.totalWin, 1);
    return enforceMod1CenterScatterOnBook(book, config);
}

function bookBuyPlayerPayout(book, bookIndex) {
    if (bookIndex === BUY_EXTREME_MAX_WIN_BOOK_ID) {
        return BUY_EXTREME_MAX_WIN_AT_BET1;
    }
    return Math.min(Number(book?.totalWin) || 0, BUY_EXTREME_MAX_WIN_AT_BET1);
}

function computeBuyExtremeRtpMetrics(books, spinCostMult) {
    const totalPaidBet = TOTAL_BOOKS * spinCostMult;
    let totalWin = 0;
    for (let i = 0; i < books.length; i++) {
        totalWin += bookBuyPlayerPayout(books[i], i);
    }
    const rtp = totalPaidBet > 0 ? (totalWin / totalPaidBet) * 100 : 0;
    const sumBaseWin = books.reduce((s, b) => s + Number(b.spin.win), 0);
    const rtpBaseSpinOnlyPct = totalPaidBet > 0 ? (sumBaseWin / totalPaidBet) * 100 : 0;
    return { totalPaidBet, totalWin, sumBaseWin, rtp, rtpBaseSpinOnlyPct };
}

function flattenBuyVariedPool(pools, bucketDefs, spinCostMult) {
    const cost = Number(spinCostMult) || 68;
    const low = [];
    const high = [];
    for (const b of bucketDefs) {
        for (const book of pools[b.id] || []) {
            const pay = Math.min(Number(book.totalWin) || 0, BUY_EXTREME_MAX_WIN_AT_BET1);
            const entry = { book, pay };
            if (pay < cost * 0.85) low.push(entry);
            else if (pay >= cost) high.push(entry);
        }
    }
    low.sort((a, b) => a.pay - b.pay);
    high.sort((a, b) => a.pay - b.pay);
    return { low, high, all: [...low, ...high] };
}

function pickPoolEntryForDeficit(pool, idealPay) {
    if (!pool.length) return null;
    let best = pool[0];
    let bestDist = Math.abs(best.pay - idealPay);
    const sample = Math.min(pool.length, 1200);
    for (let i = 0; i < sample; i++) {
        const c = pool[Math.floor(Math.random() * pool.length)];
        const d = Math.abs(c.pay - idealPay);
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}

function tuneBuyBooksRtp(books, tunableIndices, pools, bucketDefs, config, spinCostMult, targetRtp) {
    const targetWinSum = TOTAL_BOOKS * spinCostMult * (targetRtp / 100);
    const { low, high, all } = flattenBuyVariedPool(pools, bucketDefs, spinCostMult);
    if (!all.length) return;

    const poolHigh = high.length ? high : all;
    const poolLow = low.length ? low : all;

    for (let pass = 0; pass < 600; pass++) {
        let totalWin = 0;
        for (let i = 0; i < books.length; i++) {
            totalWin += bookBuyPlayerPayout(books[i], i);
        }
        const deficit = targetWinSum - totalWin;
        if (Math.abs(deficit) < spinCostMult * 1.5) {
            console.log(`  RTP подогнан за ${pass} проходов: ${((totalWin / (TOTAL_BOOKS * spinCostMult)) * 100).toFixed(4)}%`);
            return;
        }

        const needMore = deficit > 0;
        const ranked = tunableIndices
            .map((idx) => ({ idx, pay: bookBuyPlayerPayout(books[idx], idx) }))
            .sort((a, b) => (needMore ? a.pay - b.pay : b.pay - a.pay));

        const batch = Math.min(350, ranked.length);
        const idealDelta = deficit / batch;

        for (let k = 0; k < batch; k++) {
            const { idx, pay } = ranked[k];
            const idealPay = Math.max(0, pay + idealDelta);
            const pool = needMore ? poolHigh : poolLow;
            const entry = pickPoolEntryForDeficit(pool, idealPay);
            if (!entry) continue;
            books[idx] = cloneBookToIndex(entry.book, idx, config);
        }
    }

    const finalWin = books.reduce((s, b, i) => s + bookBuyPlayerPayout(b, i), 0);
    console.warn(
        `  [buy] RTP после подгонки: ${((finalWin / (TOTAL_BOOKS * spinCostMult)) * 100).toFixed(4)}% (цель ${targetRtp}%)`
    );
}

function printBuyVolatilityStats(books, config, bucketDefs) {
    const spinCostMult = Number(config.spinCostMult) || 68;
    const maxBook = books[BUY_EXTREME_MAX_WIN_BOOK_ID];
    const maxWin = maxBook ? Number(maxBook.totalWin) : 0;
    const mults = books.map((b) => Number(b.totalWin)).sort((a, b) => a - b);
    const p50 = mults[Math.floor(mults.length * 0.5)];
    const p99 = mults[Math.floor(mults.length * 0.99)];

    console.log('\nРАСПРЕДЕЛЕНИЕ ПОКУПКИ БОНУСА (total_win@1):');
    console.log('='.repeat(60));
    for (const b of bucketDefs) {
        const n = books.filter(
            (bk, i) => i !== BUY_EXTREME_MAX_WIN_BOOK_ID
                && classifyBookBuyBucket(bk.totalWin, bucketDefs) === b.id
        ).length;
        console.log(`${b.label.padEnd(16)} ${String(n).padStart(6)} (${(n / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    }
    const jpN = books[BUY_EXTREME_MAX_WIN_BOOK_ID] ? 1 : 0;
    console.log(`${'джекпот 41500×'.padEnd(16)} ${String(jpN).padStart(6)} (${(jpN / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(
        `Джекпот id=${BUY_EXTREME_MAX_WIN_BOOK_ID}: `
        + `${maxBook?.spin?.seed || '—'} → raw ${maxWin.toFixed(2)}x, выплата ${BUY_EXTREME_MAX_WIN_AT_BET1}x`
    );
    console.log(
        `Окупают ставку (≥${spinCostMult}x): `
        + `${books.filter((bk, i) => i !== BUY_EXTREME_MAX_WIN_BOOK_ID && bk.totalWin >= spinCostMult).length} `
        + `(${(books.filter((bk, i) => i !== BUY_EXTREME_MAX_WIN_BOOK_ID && bk.totalWin >= spinCostMult).length / TOTAL_BOOKS * 100).toFixed(2)}%)`
    );
    console.log(`Медиана: ${p50.toFixed(2)}x | p99: ${p99.toFixed(2)}x | макс raw: ${mults[mults.length - 1].toFixed(2)}x`);
    console.log('='.repeat(60));
}

/**
 * Покупка бонуса: разнообразные total_win@1 по корзинам (как базовые спины),
 * RTP 96%, один синтетический максвин-сид на id=BUY_EXTREME_MAX_WIN_BOOK_ID.
 */
function runBuyBooksExtremeGeneration(config) {
    const {
        outputFile,
        spinCostMult,
        label,
        targetRtp = DEFAULT_TARGET_RTP_PCT
    } = config;

    const startTime = Date.now();
    const bucketDefs = getBuyVariedBucketDefs(spinCostMult);
    const slotCount = TOTAL_BOOKS - 1;

    console.log('\n' + '='.repeat(60));
    console.log(`Генерация (разнообразные исходы): ${label}`);
    console.log('  Корзины total_win@1 (как у базовых спинов, без 90% только 10–15×):');
    for (const b of bucketDefs) {
        console.log(`    ${b.label}: ~${(b.frac * 100).toFixed(1)}%`);
    }
    console.log(`  Джекпот id ${BUY_EXTREME_MAX_WIN_BOOK_ID}: выплата ${BUY_EXTREME_MAX_WIN_AT_BET1}x@1`);
    console.log(`  RTP цель: ${targetRtp}% | totalBet=${(TOTAL_BOOKS * spinCostMult).toFixed(0)}`);
    console.log('='.repeat(60));

    console.log('\nСбор пулов по корзинам…');
    const pools = collectBuyVariedPools(config, bucketDefs, (attempt, status) => {
        console.log(`  попыток ${attempt}: ${status}`);
    });

    for (const b of bucketDefs) {
        const n = pools[b.id].length;
        if (n < 50) {
            console.warn(`  [buy] мало книг в корзине ${b.label}: ${n}`);
        }
    }

    console.log(`\nСинтетический джекпот id=${BUY_EXTREME_MAX_WIN_BOOK_ID}…`);
    const maxBook = buildSyntheticJackpotBook(BUY_EXTREME_MAX_WIN_BOOK_ID, config);
    console.log(`  seed=${maxBook.spin.seed} raw=${Number(maxBook.totalWin).toFixed(2)}x payout=${BUY_EXTREME_MAX_WIN_AT_BET1}x`);

    const books = new Array(TOTAL_BOOKS);
    books[BUY_EXTREME_MAX_WIN_BOOK_ID] = maxBook;

    const quotas = bucketDefs.map((b) => ({
        ...b,
        count: Math.max(0, Math.round(slotCount * b.frac))
    }));
    let quotaSum = quotas.reduce((s, q) => s + q.count, 0);
    while (quotaSum > slotCount) {
        const q = quotas.reduce((a, b) => (b.count > a.count ? b : a));
        q.count--;
        quotaSum--;
    }
    while (quotaSum < slotCount) {
        const q = quotas.reduce((a, b) => (b.frac > a.frac ? b : a));
        q.count++;
        quotaSum++;
    }

    const indices = [];
    for (let i = 0; i < TOTAL_BOOKS; i++) {
        if (i !== BUY_EXTREME_MAX_WIN_BOOK_ID) indices.push(i);
    }
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    let ptr = 0;
    const tunableIndices = [];
    console.log('\nРасстановка книг по корзинам…');
    for (const q of quotas) {
        const pool = pools[q.id];
        if (!pool.length) {
            console.warn(`  [buy] пустой пул ${q.label}, пропуск ${q.count} слотов`);
        }
        for (let k = 0; k < q.count && ptr < indices.length; k++) {
            const idx = indices[ptr++];
            tunableIndices.push(idx);
            if (pool.length) {
                const src = pool[Math.floor(Math.random() * pool.length)];
                books[idx] = cloneBookToIndex(src, idx, config);
            } else {
                books[idx] = makeBookInWinRange(idx, config, q.min, q.max, 8000);
            }
        }
    }
    while (ptr < indices.length) {
        const idx = indices[ptr++];
        tunableIndices.push(idx);
        const fallback = pools[bucketDefs[5].id] || pools[bucketDefs[0].id] || [];
        if (fallback.length) {
            books[idx] = cloneBookToIndex(fallback[Math.floor(Math.random() * fallback.length)], idx, config);
        } else {
            books[idx] = makeBookAtIndex(idx, config);
        }
    }

    console.log('Подгонка RTP…');
    tuneBuyBooksRtp(books, tunableIndices, pools, bucketDefs, config, spinCostMult, targetRtp);

    const metrics = computeBuyExtremeRtpMetrics(books, spinCostMult);
    printBuyVolatilityStats(books, config, bucketDefs);

    const elapsedTime = Date.now() - startTime;
    const { totalPaidBet: totalBet, totalWin, rtp, rtpBaseSpinOnlyPct } = metrics;
    const bonusCount = books.filter((b) => b.hasBonus).length;

    console.log('='.repeat(60));
    console.log(`РЕЗУЛЬТАТЫ (${label}):`);
    console.log('='.repeat(60));
    console.log(`Всего книг:                ${TOTAL_BOOKS}`);
    console.log(`Книг с бонусом:            ${bonusCount}`);
    console.log(`Ставка платного спина:     ${spinCostMult}×`);
    console.log(`Всего ставок (RTP):        ${totalBet.toFixed(2)}`);
    console.log(`Общий выигрыш:             ${totalWin.toFixed(2)}`);
    console.log(`РТП (Return To Player):    ${rtp.toFixed(4)}%`);
    console.log(`Время генерации:           ${(elapsedTime / 1000).toFixed(2)} сек`);
    console.log('='.repeat(60));

    writeBooksFile(outputFile, books, config, metrics);
    console.log(`\nФайл записан: ${outputFile}`);
    printWinStats(books, label);
    return { rtp, totalBet, totalWin, bonusCount };
}

/** Hit = любая выплата на seed (линии и/или бонус); miss = total_win@1 === 0. */
function isBookHit(book) {
    return Number(book?.totalWin) > 0;
}

function computeHitRateMetrics(books) {
    const hitCount = books.filter(isBookHit).length;
    const missCount = books.length - hitCount;
    const hitRatePct = books.length > 0 ? (hitCount / books.length) * 100 : 0;
    return { hitCount, missCount, hitRatePct };
}

function makeBookAtIndexForHitClass(i, config, wantHit) {
    const maxTries = wantHit ? 400 : 2500;
    for (let t = 0; t < maxTries; t++) {
        const book = makeBookAtIndex(i, config);
        if (wantHit === isBookHit(book)) return book;
    }
    return makeBookAtIndex(i, config);
}

/**
 * Подгонка hit rate: ровно targetHitRate доля книг с total_win > 0, остальные 0×.
 */
function adjustBooksToTargetHitRate(books, config, targetHitRate = DEFAULT_TARGET_HIT_RATE) {
    const { label } = config;
    const targetHits = Math.round(TOTAL_BOOKS * targetHitRate);
    const maxPasses = 400;
    let pass = 0;

    while (pass < maxPasses) {
        const { hitCount } = computeHitRateMetrics(books);
        const gap = targetHits - hitCount;
        if (Math.abs(gap) <= HIT_RATE_TOLERANCE) {
            const hr = computeHitRateMetrics(books);
            console.log(
                `Hit rate (${label}): ${hr.hitRatePct.toFixed(2)}% `
                + `(${hr.hitCount} hit / ${hr.missCount} miss @0×, цель ${(targetHitRate * 100).toFixed(0)}%)`
            );
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
            console.log(
                `  коррекция hit (${label}): проход ${pass}, `
                + `${hr.hitRatePct.toFixed(2)}% hit, цель ${(targetHitRate * 100).toFixed(0)}%`
            );
        }
    }

    const hr = computeHitRateMetrics(books);
    console.warn(
        `Hit rate (${label}): не достигнута точность — ${hr.hitRatePct.toFixed(2)}% `
        + `(цель ${(targetHitRate * 100).toFixed(0)}%)`
    );
    return hr;
}

function makeBookReplacement(bookIdx, config, oldBook) {
    if (config.targetHitRate > 0) {
        return makeBookAtIndexForHitClass(bookIdx, config, isBookHit(oldBook));
    }
    return makeBookAtIndex(bookIdx, config);
}

/**
 * Подгонка RTP заменой книг (сетки/бонус остаются валидными, меняются только выбранные строки).
 * totalBet = только платный спин (×spinCostMult), фри-спины в ставку не входят.
 */
function makeBookAtIndexMinWin(i, config, minTotalWin) {
    const floor = Math.max(0, Number(minTotalWin) || 0);
    for (let t = 0; t < 600; t++) {
        const book = makeBookAtIndexForHitClass(i, config, true);
        if (book.totalWin >= floor) return book;
    }
    return makeBookAtIndexForHitClass(i, config, true);
}

function makeBookAtIndexMaxWin(i, config, maxTotalWin) {
    const cap = Math.max(0.01, Number(maxTotalWin) || 0.01);
    for (let t = 0; t < 500; t++) {
        const book = makeBookAtIndexForHitClass(i, config, true);
        if (book.totalWin > 0 && book.totalWin <= cap) return book;
    }
    let best = null;
    for (let t = 0; t < 300; t++) {
        const book = makeBookAtIndexForHitClass(i, config, true);
        if (book.totalWin <= 0) continue;
        if (!best || book.totalWin < best.totalWin) best = book;
        if (book.totalWin <= cap) return book;
    }
    return best || makeBookAtIndexForHitClass(i, config, true);
}

function adjustBooksToTargetRtp(books, config, targetRtpPct = DEFAULT_TARGET_RTP_PCT) {
    const { spinCostMult, label } = config;
    const maxPasses = config.targetHitRate > 0 ? 500 : 300;
    let pass = 0;

    while (pass < maxPasses) {
        const metrics = computeRtpMetrics(books, spinCostMult);
        const gap = targetRtpPct - metrics.rtp;

        if (Math.abs(gap) <= RTP_ADJUST_TOLERANCE_PCT) {
            console.log(`RTP скорректирован (${label}): ${metrics.rtp.toFixed(4)}% (цель ${targetRtpPct}%)`);
            return metrics;
        }

        const targetWin = (targetRtpPct / 100) * metrics.totalPaidBet;
        const deficit = targetWin - metrics.totalWin;
        const needMoreWin = deficit > 0;

        const hitCount = config.targetHitRate > 0 ? books.filter(isBookHit).length : TOTAL_BOOKS;
        const targetAvgHitWin = hitCount > 0 ? targetWin / hitCount : 0;

        let batchSize;
        if (config.targetHitRate > 0 && hitCount > 0) {
            const perHitGap = Math.abs(deficit) / hitCount;
            batchSize = Math.min(600, Math.max(25, Math.ceil(perHitGap / Math.max(targetAvgHitWin * 0.08, 0.02))));
        } else {
            const avgWin = metrics.totalWin / TOTAL_BOOKS || 1;
            batchSize = Math.min(
                3000,
                Math.max(100, Math.ceil(Math.abs(deficit) / Math.max(avgWin * 0.35, 0.5)))
            );
        }

        const ranked = books
            .map((b, idx) => ({ idx, w: Number(b.totalWin), hit: isBookHit(b) }))
            .filter((x) => {
                if (!(config.targetHitRate > 0)) return true;
                return x.hit;
            })
            .sort((a, b) => (needMoreWin ? a.w - b.w : b.w - a.w));

        for (let k = 0; k < batchSize && k < ranked.length; k++) {
            const bookIdx = ranked[k].idx;
            const oldWin = ranked[k].w;
            const oldBook = books[bookIdx];
            let newBook;

            if (config.targetHitRate > 0) {
                if (needMoreWin) {
                    const minW = Math.max(
                        oldWin + 0.02,
                        targetAvgHitWin * 0.92,
                        targetAvgHitWin + deficit / Math.max(1, batchSize)
                    );
                    newBook = makeBookAtIndexMinWin(bookIdx, config, minW);
                } else {
                    const capW = Math.max(
                        0.01,
                        Math.min(
                            oldWin * 0.75,
                            targetAvgHitWin * 1.05,
                            oldWin - Math.max(0.02, Math.abs(deficit) / Math.max(1, batchSize))
                        )
                    );
                    newBook = makeBookAtIndexMaxWin(bookIdx, config, capW);
                }
            } else {
                newBook = makeBookReplacement(bookIdx, config, oldBook);
                let tries = 0;
                while (tries < 120) {
                    const improved = needMoreWin ? newBook.totalWin > oldWin : newBook.totalWin < oldWin;
                    if (improved || tries >= 50) break;
                    newBook = makeBookReplacement(bookIdx, config, oldBook);
                    tries++;
                }
            }

            if (config.targetHitRate > 0 && !isBookHit(newBook)) {
                newBook = makeBookAtIndexForHitClass(bookIdx, config, true);
            }
            books[bookIdx] = newBook;
        }

        pass++;
        if (pass === 1 || pass % 10 === 0) {
            const m = computeRtpMetrics(books, spinCostMult);
            console.log(
                `  коррекция RTP (${label}): проход ${pass}, RTP=${m.rtp.toFixed(4)}%, `
                + `цель=${targetRtpPct}%, Δ=${(m.rtp - targetRtpPct).toFixed(3)}%`
            );
        }
    }

    const final = computeRtpMetrics(books, spinCostMult);
    console.warn(
        `RTP (${label}): не достигнута точность за ${maxPasses} проходов — `
        + `${final.rtp.toFixed(4)}% (цель ${targetRtpPct}%)`
    );
    return final;
}

function spinFromEncodedParts(reelsEnc, weightsEnc, seedLabel = '') {
    const reelGroups = reelsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    const weightGroups = weightsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    if (reelGroups.length !== NUM_REELS || weightGroups.length !== NUM_REELS) return null;

    const spin = { seed: seedLabel, weights: weightGroups, win: 0 };
    for (let r = 0; r < NUM_REELS; r++) {
        if (reelGroups[r].length !== VISIBLE_ROWS || weightGroups[r].length !== VISIBLE_ROWS) return null;
        spin[`reel${r}`] = reelGroups[r];
    }
    return spin;
}

function parseBookLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const cols = trimmed.split('\t');
    if (cols.length < 5) return null;

    const seed = cols[0].trim();
    const totalWin = Number(cols[1]);
    const hasBonusMeta = cols[2].trim() === '1';
    const spin = spinFromEncodedParts(cols[3], cols[4], seed);
    if (!spin || !seed) return null;

    const namesGrid = Array.from({ length: NUM_REELS }, (_, r) =>
        Array.from({ length: VISIBLE_ROWS }, (_, row) => SYMBOLS[spin[`reel${r}`][row]])
    );
    const baseWin = calculateWin(1, namesGrid, spin.weights);
    spin.win = baseWin;

    let scatterOnBase = countScatters(namesGrid);
    let bonusSpins = [];
    let bonusWin = 0;

    if (hasBonusMeta && scatterOnBase >= 3) {
        const need = { 3: 7, 4: 8, 5: 10 }[scatterOnBase];
        const n = Number(cols[5]);
        if (need && n === need && cols.length >= 6 + n * 2) {
            const tailCols = cols.length - 6;
            const colsPerSpin = tailCols / need;
            const hasLandingCol = colsPerSpin >= 3 && cols.length >= 6 + need * 3;
            let ci = 6;
            for (let i = 0; i < n; i++) {
                const bs = spinFromEncodedParts(cols[ci++], cols[ci++], `${seed}_b${i + 1}`);
                if (!bs) {
                    bonusSpins = [];
                    break;
                }
                if (hasLandingCol) {
                    const landingParts = cols[ci++].split('|');
                    for (let r = 0; r < NUM_REELS; r++) {
                        bs[`landingReel${r}`] = landingParts[r].split(',').map(Number);
                    }
                }
                bonusSpins.push(bs);
            }
            if (bonusSpins.length === n) {
                bonusWin = Math.max(0, totalWin - baseWin);
            } else {
                bonusSpins = [];
            }
        }
    }

    return {
        seed,
        totalWin,
        hasBonus: hasBonusMeta && bonusSpins.length > 0,
        scatterCount: scatterOnBase,
        spin,
        bonusSpins,
        bonusWin: bonusSpins.length ? bonusWin : 0
    };
}

function parseBooksFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const books = [];
    for (const line of text.split(/\r?\n/)) {
        const book = parseBookLine(line);
        if (book) books.push(book);
    }
    return books;
}

function buildBooksFileContent(books, config, metrics) {
    const {
        scatterGuarantee = 0,
        spinCostMult = 1,
        seedIdPrefix = 'rv'
    } = config;
    const { totalPaidBet, totalWin, rtp, rtpBaseSpinOnlyPct } = metrics;

    const seedLines = books.map((b) => {
        const winStr = String(Number(b.totalWin));
        const hb = b.hasBonus ? '1' : '0';
        let line = `${b.spin.seed}\t${winStr}\t${hb}\t${encodeReelsLine(b.spin)}\t${encodeWeightsLine(b.spin.weights)}`;
        if (b.hasBonus && Array.isArray(b.bonusSpins) && b.bonusSpins.length > 0) {
            line += `\t${b.bonusSpins.length}`;
            for (const bs of b.bonusSpins) {
                line += `\t${encodeReelsLine(bs)}\t${encodeWeightsLine(bs.weights)}\t${encodeReelsLine(bs, 'landingReel')}`;
            }
        }
        return line;
    });

    const headerExtra = [];
    if (scatterGuarantee === 1) {
        headerExtra.push(
            '# MOD: scatter×1 — всегда scatter на 2-м барабане (reel1), центральный ряд (row1).',
            '# MOD: платная ставка 1.2× при bet=1 в RTP.',
            '# Префикс seed: rvm1_ (отдельно от базовых rv_).'
        );
    } else if (scatterGuarantee === 3 || scatterGuarantee === 4 || scatterGuarantee === 5) {
        headerExtra.push(
            `# BUY: ровно ${scatterGuarantee} scatter на поле, платная ставка ${spinCostMult}× при bet=1 в RTP.`,
            `# Префикс seed: ${seedIdPrefix}_ (покупка бонуса).`
        );
        if (config.extremeBuyVolatility) {
            const jackpotBook = books[BUY_EXTREME_MAX_WIN_BOOK_ID];
            headerExtra.push(
                '# BUY_VOLATILITY: разнообразные total_win@1 по корзинам (0, мелкие, средние, окупающие, крупные); RTP 96%.',
                `# BUY_VOLATILITY: джекпот строка ${BUY_EXTREME_MAX_WIN_BOOK_ID} — синт. xWays+split→high5, выплата ${BUY_EXTREME_MAX_WIN_AT_BET1}x@1.`,
                `# BUY_JACKPOT_SEED: ${jackpotBook?.spin?.seed || '—'}`
            );
        }
    }

    const hitLine = config.targetHitRate > 0
        ? (() => {
            const hr = computeHitRateMetrics(books);
            return `# HIT_RATE: ${hr.hitRatePct.toFixed(2)}% (hit=${hr.hitCount} miss@0x=${hr.missCount} books=${books.length})`;
        })()
        : null;

    return [
        '# BOOKS_SEEDS_V2',
        `# RTP_ALL_SEEDS: ${rtp.toFixed(4)}% (totalWin=${totalWin.toFixed(2)} totalBet=${totalPaidBet.toFixed(2)} books=${books.length})`,
        `# RTP_BASE_SPIN_ONLY: ${rtpBaseSpinOnlyPct.toFixed(4)}%`,
        '# RTP totalBet = только платный спин (×spinCostMult); фри-спины в ставку не входят.',
        ...(hitLine ? [hitLine, '# Hit = total_win@1 > 0 на платном спине; miss = 0× (без линий и без бонуса в seed).'] : []),
        ...headerExtra,
        '# Колонки (TAB): seed | total_win@1 | has_bonus | барабаны | веса [ | число_фри | на фри: reels | weights | landing ]',
        '# total_win@1 = базовый спин + бонус (выплаты при bet=1); в RTP платный спин учитывается с spinCostMult.',
        '# Индексы символов как в SYMBOLS slot.js / generate-books (low1 … split_wilds).',
        ...seedLines
    ].join('\n');
}

function writeBooksFile(outputFile, books, config, metrics) {
    fs.writeFileSync(outputFile, buildBooksFileContent(books, config, metrics));
}

function runBooksGeneration(config) {
    if (config.extremeBuyVolatility) {
        return runBuyBooksExtremeGeneration(config);
    }

    const {
        outputFile,
        scatterGuarantee = 0,
        seedIdPrefix = 'rv',
        spinCostMult = 1,
        label = 'base',
        targetRtp = DEFAULT_TARGET_RTP_PCT,
        targetHitRate = 0,
        skipRtpAdjust = false,
        skipHitAdjust = false
    } = config;
    const payoutBet = 1.0;

    console.log('\n' + '='.repeat(60));
    console.log(`Генерация: ${label} → ${outputFile}`);
    if (scatterGuarantee === 1) {
        console.log('Модификатор: 1 scatter на 2-м барабане (центр), ставка спина = 1.2× базы');
    } else if (scatterGuarantee === 3 || scatterGuarantee === 4 || scatterGuarantee === 5) {
        console.log(`Покупка бонуса: ровно ${scatterGuarantee} scatter, ставка спина = ${spinCostMult}× базы`);
    }
    console.log('='.repeat(60));

    const books = [];
    let bonusCount = 0;
    let avgBonusSpins = 0;

    const startTime = Date.now();

    for (let i = 0; i < TOTAL_BOOKS; i++) {
        if ((i + 1) % 10000 === 0) {
            const elapsed = Date.now() - startTime;
            const perBook = elapsed / (i + 1);
            const remaining = (TOTAL_BOOKS - i - 1) * perBook;
            console.log(`Книги: ${i + 1}/${TOTAL_BOOKS} (бонусов: ${bonusCount}, осталось ~${Math.round(remaining / 1000)}сек)`);
        }

        const book = makeBookAtIndex(i, config);
        if (book.hasBonus) {
            bonusCount++;
            avgBonusSpins += book.bonusSpins.length;
        }
        books.push(book);
    }

    bonusCount = books.filter((b) => b.hasBonus).length;
    avgBonusSpins = books.reduce((s, b) => s + (b.bonusSpins?.length || 0), 0);
    const bonusWithAvg = bonusCount > 0 ? (avgBonusSpins / bonusCount).toFixed(2) : 0;

    if (!skipHitAdjust && targetHitRate > 0) {
        const hr0 = computeHitRateMetrics(books);
        console.log(`\nПодгонка hit rate → ${(targetHitRate * 100).toFixed(0)}% (${label}), было ${hr0.hitRatePct.toFixed(2)}%…`);
        adjustBooksToTargetHitRate(books, config, targetHitRate);
    }

    let metrics = computeRtpMetrics(books, spinCostMult);
    if (!skipRtpAdjust && targetRtp > 0) {
        console.log(`\nПодгонка RTP → ${targetRtp}% (${label}), было ${metrics.rtp.toFixed(4)}%…`);
        metrics = adjustBooksToTargetRtp(books, config, targetRtp);
    }

    if (targetHitRate > 0 && !skipHitAdjust) {
        const hrAfter = computeHitRateMetrics(books);
        if (Math.abs(hrAfter.hitCount - Math.round(TOTAL_BOOKS * targetHitRate)) > HIT_RATE_TOLERANCE + 50) {
            console.log(`\nПовторная подгонка hit rate после RTP (${label})…`);
            adjustBooksToTargetHitRate(books, config, targetHitRate);
            metrics = computeRtpMetrics(books, spinCostMult);
        }
    }

    if (scatterGuarantee === 1) {
        enforceMod1OnAllBooks(books, config);
        metrics = computeRtpMetrics(books, spinCostMult);
        const bad = countMod1CenterScatterViolations(books);
        if (bad > 0) {
            console.warn(`[mod1] после enforce осталось ${bad} книг без scatter в центре 2-го барабана`);
        } else {
            console.log('[mod1] все книги: scatter на 2-м барабане, центр');
        }
    }

    const elapsedTime = Date.now() - startTime;
    const { totalPaidBet: totalBet, totalWin, rtp, rtpBaseSpinOnlyPct } = metrics;
    const avgBonus = bonusWithAvg;
    bonusCount = books.filter((b) => b.hasBonus).length;

    console.log('='.repeat(60));
    console.log(`РЕЗУЛЬТАТЫ (${label}):`);
    console.log('='.repeat(60));
    console.log(`Всего книг:                ${TOTAL_BOOKS}`);
    console.log(`Книг с бонусом:            ${bonusCount} (${(bonusCount / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(`Среднее фри спинов/бонус:  ${avgBonus}`);
    console.log(`Ставка платного спина:     ${spinCostMult}× (база ${payoutBet})`);
    console.log(`Всего ставок (RTP):        ${totalBet.toFixed(2)} (только платные спины ×${spinCostMult})`);
    console.log(`Общий выигрыш:             ${totalWin.toFixed(2)} (выплаты при bet=1)`);
    console.log(`РТП (Return To Player):    ${rtp.toFixed(4)}%`);
    console.log(`РТП только базовый спин:  ${rtpBaseSpinOnlyPct.toFixed(4)}%`);
    console.log(`Время генерации:           ${(elapsedTime / 1000).toFixed(2)} сек`);
    console.log('='.repeat(60));

    const sumTotalWinCol = books.reduce((s, b) => s + Number(b.totalWin), 0);
    const sumBaseWin = books.reduce((s, b) => s + Number(b.spin.win), 0);
    const sumBonusWin = books.reduce((s, b) => s + Number(b.bonusWin || 0), 0);
    console.log(`Сумма total_win в файле:   ${sumTotalWinCol.toFixed(2)} (база ${sumBaseWin.toFixed(2)} + бонус ${sumBonusWin.toFixed(2)})`);

    writeBooksFile(outputFile, books, config, metrics);

    console.log(`\nФайл записан: ${outputFile}`);

    printWinStats(books, label);
    return { rtp, totalBet, totalWin, bonusCount };
}

/** Только подгонка RTP в существующем файле (без полной перегенерации). */
function adjustRtpInExistingFile(config) {
    const { outputFile, label, targetRtp = DEFAULT_TARGET_RTP_PCT, spinCostMult } = config;
    console.log(`\nЧтение и коррекция RTP: ${label} ← ${outputFile}`);
    const books = parseBooksFile(outputFile);
    if (books.length !== TOTAL_BOOKS) {
        console.warn(`  ожидалось ${TOTAL_BOOKS} строк, получено ${books.length}`);
    }
    if (!books.length) {
        console.error('  файл пуст или не распознан');
        return null;
    }
    let metrics = computeRtpMetrics(books, spinCostMult);
    console.log(`  RTP до: ${metrics.rtp.toFixed(4)}%, totalBet=${metrics.totalPaidBet.toFixed(2)}`);
    metrics = adjustBooksToTargetRtp(books, config, targetRtp);
    if (config.scatterGuarantee === 1) {
        enforceMod1OnAllBooks(books, config);
        metrics = computeRtpMetrics(books, spinCostMult);
    }
    writeBooksFile(outputFile, books, config, metrics);
    console.log(`  записано: ${outputFile}, RTP=${metrics.rtp.toFixed(4)}%`);
    return metrics;
}

function printWinStats(books, label) {
    console.log(`\nСТАТИСТИКА БАЗОВОГО СПИНА (${label}):`);
    console.log('='.repeat(60));

    const winStats = {
        noWin: 0,
        smallWin: 0,
        breakEven: 0,
        smallProfit: 0,
        bigWin: 0,
        maxWin: 0
    };

    let totalSpinWin = 0;
    let totalWinWithBonus = 0;

    for (const book of books) {
        const spinWin = book.spin.win;
        totalSpinWin += spinWin;
        totalWinWithBonus += book.totalWin;

        if (spinWin === 0) winStats.noWin++;
        else if (spinWin < 1) winStats.smallWin++;
        else if (spinWin === 1) winStats.breakEven++;
        else if (spinWin < 3) winStats.smallProfit++;
        else winStats.bigWin++;

        winStats.maxWin = Math.max(winStats.maxWin, spinWin);
    }

    console.log(`Без выигрыша:                ${winStats.noWin} (${(winStats.noWin / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(`Маленький выигрыш (0-1x):    ${winStats.smallWin} (${(winStats.smallWin / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(`Даже (=1x):                  ${winStats.breakEven} (${(winStats.breakEven / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(`Маленькая прибыль (1-3x):   ${winStats.smallProfit} (${(winStats.smallProfit / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(`Крупный выигрыш (3x+):      ${winStats.bigWin} (${(winStats.bigWin / TOTAL_BOOKS * 100).toFixed(2)}%)`);
    console.log(`Максимальный выигрыш:       ${winStats.maxWin.toFixed(2)}x (bet=1)`);
    console.log(`Средний выигрыш на спин:    ${(totalSpinWin / TOTAL_BOOKS).toFixed(2)}x`);
    console.log(`Средний total_win (с бонусом): ${(totalWinWithBonus / TOTAL_BOOKS).toFixed(2)}x`);
    console.log('='.repeat(60));
}

const ROOT = 'd:/rave slot';

const BOOK_GENERATORS = {
    base: {
        outputFile: `${ROOT}/books-seeds.txt`,
        scatterGuarantee: 0,
        seedIdPrefix: 'rv',
        spinCostMult: 1,
        label: 'базовые спины',
        targetRtp: DEFAULT_TARGET_RTP_PCT,
        targetHitRate: DEFAULT_TARGET_HIT_RATE
    },
    mod1: {
        outputFile: `${ROOT}/books-seeds-mod-scatter1.txt`,
        scatterGuarantee: 1,
        seedIdPrefix: 'rvm1',
        spinCostMult: 1.2,
        label: 'mod scatter×1 (ставка 1.2×)',
        targetRtp: DEFAULT_TARGET_RTP_PCT,
        targetHitRate: DEFAULT_TARGET_HIT_RATE
    },
    buy3: {
        outputFile: `${ROOT}/books-seeds-buy-scatter3.txt`,
        scatterGuarantee: 3,
        seedIdPrefix: 'rvb3',
        spinCostMult: 68,
        label: 'покупка бонуса 3 scatter (ставка 68×)',
        targetRtp: DEFAULT_TARGET_RTP_PCT,
        extremeBuyVolatility: true,
        skipRtpAdjust: true,
        skipHitAdjust: true
    },
    buy4: {
        outputFile: `${ROOT}/books-seeds-buy-scatter4.txt`,
        scatterGuarantee: 4,
        seedIdPrefix: 'rvb4',
        spinCostMult: 140,
        label: 'покупка бонуса 4 scatter (ставка 140×)',
        targetRtp: DEFAULT_TARGET_RTP_PCT,
        extremeBuyVolatility: true,
        skipRtpAdjust: true,
        skipHitAdjust: true
    },
    buy5: {
        outputFile: `${ROOT}/books-seeds-buy-scatter5.txt`,
        scatterGuarantee: 5,
        seedIdPrefix: 'rvb5',
        spinCostMult: 522,
        label: 'покупка бонуса 5 scatter (ставка 522×)',
        targetRtp: DEFAULT_TARGET_RTP_PCT,
        extremeBuyVolatility: true,
        skipRtpAdjust: true,
        skipHitAdjust: true
    }
};

const argv = process.argv.slice(2);
const runKeys = new Set();

const rtpTargetArg = argv.find((a) => a.startsWith('--rtp-target='));
const globalTargetRtp = rtpTargetArg
    ? Number(rtpTargetArg.split('=')[1])
    : DEFAULT_TARGET_RTP_PCT;
const noRtpAdjust = argv.includes('--no-rtp-adjust');
const noHitAdjust = argv.includes('--no-hit-adjust');
const adjustRtpOnly = argv.includes('--adjust-rtp-only');
const recalcHeadersOnly = argv.includes('--recalc-headers-only');

if (argv.includes('--base-mod') || argv.includes('--hit26')) {
    runKeys.add('base');
    runKeys.add('mod1');
}
if (argv.includes('--all')) {
    runKeys.add('base');
    runKeys.add('mod1');
}
if (argv.includes('--buy-all')) {
    runKeys.add('buy3');
    runKeys.add('buy4');
    runKeys.add('buy5');
}
if (argv.includes('--everything')) {
    runKeys.add('base');
    runKeys.add('mod1');
    runKeys.add('buy3');
    runKeys.add('buy4');
    runKeys.add('buy5');
}
if (argv.includes('--mod-scatter1')) runKeys.add('mod1');
if (argv.includes('--buy-scatter3')) runKeys.add('buy3');
if (argv.includes('--buy-scatter4')) runKeys.add('buy4');
if (argv.includes('--buy-scatter5')) runKeys.add('buy5');

if (runKeys.size === 0) {
    runKeys.add('base');
}

function recalcHeadersInExistingFile(config) {
    const { outputFile, label, spinCostMult } = config;
    console.log(`\nПересчёт шапки RTP (без смены книг): ${label} ← ${outputFile}`);
    const books = parseBooksFile(outputFile);
    if (!books.length) {
        console.error('  файл пуст или не распознан');
        return null;
    }
    const metrics = computeRtpMetrics(books, spinCostMult);
    writeBooksFile(outputFile, books, config, metrics);
    console.log(`  RTP=${metrics.rtp.toFixed(4)}%, totalBet=${metrics.totalPaidBet.toFixed(2)}`);
    return metrics;
}

for (const key of runKeys) {
    const cfg = {
        ...BOOK_GENERATORS[key],
        targetRtp: Number.isFinite(globalTargetRtp) ? globalTargetRtp : DEFAULT_TARGET_RTP_PCT,
        skipRtpAdjust: noRtpAdjust,
        skipHitAdjust: noHitAdjust
    };
    if (recalcHeadersOnly) {
        recalcHeadersInExistingFile(cfg);
    } else if (adjustRtpOnly) {
        adjustRtpInExistingFile(cfg);
    } else {
        runBooksGeneration(cfg);
    }
}
