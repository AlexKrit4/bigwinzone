'use strict';

/**
 * Симуляция исходов спина как в slot.js (без DOM/анимаций), чтобы books-seeds совпадали с RNG слота.
 * Синхронизировать при изменении: generateResult (бонус), остановка барабана (энхансеры),
 * resolveSplitsAndUpdateBoardAnimated, resolveXWaysAndUpdateBoardAnimated, maybeResolveExactlyTwoScatters.
 */

function randomInt(minInclusive, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

function getBonusEnhancerReels(bonusScatterCount) {
    if (bonusScatterCount >= 5) return [0, 1, 2, 3, 4];
    if (bonusScatterCount === 4) return [1, 2, 3, 4];
    return [1, 2, 3];
}

function getRandomSymbolIndex(SYMBOLS, omitScatter, xWaysFact, wildFact, scatterW) {
    const weights = SYMBOLS.map((name) => {
        if (name === 'split' || name === 'split_wilds') return 0;
        if (omitScatter && name === 'scatter') return 0;
        if (name === 'xWays') return 1 / xWaysFact;
        if (name === 'wild') return 1 / wildFact;
        if (name === 'scatter') return scatterW;
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

/** RNG поля фри-спина: как slot.js generateResult при isBonusGame === true */
function generateBonusRawResult(ctx) {
    const {
        SYMBOLS,
        NUM_REELS,
        VISIBLE_ROWS,
        bonusScatterCount,
        XWAYS_REDUCTION_FACTOR,
        WILD_REDUCTION_FACTOR,
        SCATTER_WEIGHT
    } = ctx;

    const scatterIndex = SYMBOLS.indexOf('scatter');

    const pickRandomNonScatterIndex = () => {
        for (let attempts = 0; attempts < 40; attempts++) {
            const idx = getRandomSymbolIndex(SYMBOLS, true, XWAYS_REDUCTION_FACTOR, WILD_REDUCTION_FACTOR, SCATTER_WEIGHT);
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
            let idx = pickRandomNonScatterIndex();

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

    const enhancerReels = getBonusEnhancerReels(bonusScatterCount);
    const enhancerPool = ['high1', 'high2', 'high3', 'high4', 'high5', 'wild', 'xWays', 'split'];

    for (const r of enhancerReels) {
        const sym = enhancerPool[Math.floor(Math.random() * enhancerPool.length)];
        result[r][VISIBLE_ROWS - 1] = SYMBOLS.indexOf(sym);
    }

    if (bonusScatterCount === 3 && Math.random() < 0.04) {
        result[4][Math.floor(Math.random() * VISIBLE_ROWS)] = scatterIndex;
    } else if (bonusScatterCount === 4 && Math.random() < 0.05) {
        result[0][Math.floor(Math.random() * VISIBLE_ROWS)] = scatterIndex;
    }

    return result;
}

/** После остановки всех барабанов подряд 0→4 (как порядок завершения со stagger в слоте) */
function applyBonusReelLanding(finalResult, bonusScatterCount, bonusEnhancerMults, SYMBOLS, NUM_REELS, VISIBLE_ROWS) {
    const board = [];
    const mults = [];
    const enhancerReels = getBonusEnhancerReels(bonusScatterCount);

    for (let reelIndex = 0; reelIndex < NUM_REELS; reelIndex++) {
        board[reelIndex] = finalResult[reelIndex].map((i) => SYMBOLS[i]);
        mults[reelIndex] = [1, 1, 1];

        if (enhancerReels.includes(reelIndex)) {
            const bottomSymName = board[reelIndex][2];
            if (bottomSymName === 'split_wilds') {
                mults[reelIndex][2] = 2;
            } else if (bottomSymName && !['xWays', 'wild', 'split'].includes(bottomSymName)) {
                if ([1, 2, 3].includes(reelIndex)) {
                    mults[reelIndex][2] = bonusEnhancerMults[reelIndex];
                }
            }
        }
    }

    return { board, mults };
}

function applyBaseSpinLanding(finalResult, SYMBOLS, NUM_REELS, VISIBLE_ROWS) {
    const board = [];
    const mults = [];
    for (let reelIndex = 0; reelIndex < NUM_REELS; reelIndex++) {
        board[reelIndex] = finalResult[reelIndex].map((i) => SYMBOLS[i]);
        mults[reelIndex] = [1, 1, 1];
    }
    return { board, mults };
}

/** bonusEnhancerMults: массив или null (база — без инкремента в окошках) */
function syncResolveSplits(board, mults, bonusEnhancerMults, NUM_REELS) {
    for (let reel = 0; reel < NUM_REELS; reel++) {
        if (board[reel][2] !== 'split') continue;

        for (let row = 0; row < 2; row++) {
            mults[reel][row] = (mults[reel][row] || 1) * 2;
        }

        board[reel][2] = 'split_wilds';
        mults[reel][2] = 2;

        if (bonusEnhancerMults && [1, 2, 3].includes(reel)) {
            bonusEnhancerMults[reel] += 2;
        }
    }
}

function syncResolveXWaysInPlace(board, mults, PAYOUTS, NUM_REELS, VISIBLE_ROWS) {
    const payableSymbols = Object.keys(PAYOUTS);
    const positions = [];

    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (board[reel][row] === 'xWays') positions.push({ reel, row });
        }
    }

    if (!positions.length) return { xWaysReplacementSymbol: null };

    const replacementSymbol = payableSymbols[Math.floor(Math.random() * payableSymbols.length)];

    for (const t of positions) {
        const baseMult = mults[t.reel][t.row] || 1;
        const xWaysMult = randomInt(2, 7);
        board[t.reel][t.row] = replacementSymbol;
        mults[t.reel][t.row] = baseMult * xWaysMult;
    }

    return { xWaysReplacementSymbol: replacementSymbol };
}

function countScatters(namesGrid, NUM_REELS, VISIBLE_ROWS) {
    let count = 0;
    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (namesGrid[reel][row] === 'scatter') count++;
        }
    }
    return count;
}

function syncMaybeTwoScatters(
    namesGrid,
    weightsGrid,
    board,
    mults,
    existingXWaysReplacementSymbol,
    PAYOUTS,
    NUM_REELS,
    VISIBLE_ROWS,
    protectedCells = []
) {
    if (countScatters(namesGrid, NUM_REELS, VISIBLE_ROWS) !== 2) {
        return { namesGrid, weightsGrid, xWaysReplacementSymbol: existingXWaysReplacementSymbol };
    }

    const isProtected = (reel, row) =>
        protectedCells.some((p) => p.reel === reel && p.row === row);

    const payableSymbols = Object.keys(PAYOUTS);
    const miniSymbols = ['high1', 'high2', 'high3', 'high4', 'high5', 'wild', 'xWays'];
    const scatterPositions = [];

    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (namesGrid[reel][row] === 'scatter') scatterPositions.push({ reel, row });
        }
    }

    const mutablePositions = scatterPositions.filter((p) => !isProtected(p.reel, p.row));
    if (!mutablePositions.length) {
        return { namesGrid, weightsGrid, xWaysReplacementSymbol: existingXWaysReplacementSymbol };
    }

    const outcomes = mutablePositions.map(() => miniSymbols[Math.floor(Math.random() * miniSymbols.length)]);

    let xWaysReplacementSymbol = existingXWaysReplacementSymbol;
    if (!xWaysReplacementSymbol && outcomes.includes('xWays')) {
        xWaysReplacementSymbol = payableSymbols[Math.floor(Math.random() * payableSymbols.length)];
    }

    mutablePositions.forEach((pos, idx) => {
        const outcome = outcomes[idx];

        if (outcome === 'xWays') {
            const replacement = xWaysReplacementSymbol || payableSymbols[Math.floor(Math.random() * payableSymbols.length)];
            const mult = randomInt(2, 7);

            namesGrid[pos.reel][pos.row] = replacement;
            weightsGrid[pos.reel][pos.row] = mult;
            board[pos.reel][pos.row] = replacement;
            mults[pos.reel][pos.row] = mult;
        } else {
            namesGrid[pos.reel][pos.row] = outcome;
            weightsGrid[pos.reel][pos.row] = 1;
            board[pos.reel][pos.row] = outcome;
            mults[pos.reel][pos.row] = 1;
        }
    });

    return { namesGrid, weightsGrid, xWaysReplacementSymbol };
}

function simulateBaseSpinOutcome(spinIndices, ctx, options = {}) {
    const {
        SYMBOLS,
        NUM_REELS,
        VISIBLE_ROWS,
        PAYOUTS
    } = ctx;

    const { board, mults } = applyBaseSpinLanding(spinIndices, SYMBOLS, NUM_REELS, VISIBLE_ROWS);

    syncResolveSplits(board, mults, null, NUM_REELS);

    const xw = syncResolveXWaysInPlace(board, mults, PAYOUTS, NUM_REELS, VISIBLE_ROWS);

    const namesGrid = board.map((r) => [...r]);
    const weightsGrid = mults.map((r) => [...r]);

    const protectedCells = options.forceScatterReel1Center ? [{ reel: 1, row: 1 }] : [];

    return syncMaybeTwoScatters(
        namesGrid,
        weightsGrid,
        board,
        mults,
        xw.xWaysReplacementSymbol,
        PAYOUTS,
        NUM_REELS,
        VISIBLE_ROWS,
        protectedCells
    );
}

function simulateBonusGame(bonusScatterCount, parentBookId, ctx) {
    const {
        SYMBOLS,
        NUM_REELS,
        VISIBLE_ROWS,
        PAYOUTS,
        calculateWin,
        winMultiplier,
        makeSpinSeed,
        SCATTER_WEIGHT,
        XWAYS_REDUCTION_FACTOR,
        WILD_REDUCTION_FACTOR
    } = ctx;

    const bonusSpinsNeeded = { 3: 7, 4: 8, 5: 10 }[bonusScatterCount] || 0;
    const bonusEnhancerMults = [2, 2, 2, 2, 2];
    const bonusSpins = [];
    let totalBonusWin = 0;

    const genCtx = {
        SYMBOLS,
        NUM_REELS,
        VISIBLE_ROWS,
        bonusScatterCount,
        XWAYS_REDUCTION_FACTOR,
        WILD_REDUCTION_FACTOR,
        SCATTER_WEIGHT
    };

    for (let spin = 0; spin < bonusSpinsNeeded; spin++) {
        const finalResult = generateBonusRawResult(genCtx);
        const { board, mults } = applyBonusReelLanding(
            finalResult,
            bonusScatterCount,
            bonusEnhancerMults,
            SYMBOLS,
            NUM_REELS,
            VISIBLE_ROWS
        );

        const landingReels = board.map((reel) => reel.map((s) => SYMBOLS.indexOf(s)));

        syncResolveSplits(board, mults, bonusEnhancerMults, NUM_REELS);

        const xw = syncResolveXWaysInPlace(board, mults, PAYOUTS, NUM_REELS, VISIBLE_ROWS);

        const namesGrid = board.map((r) => [...r]);
        const weightsGrid = mults.map((r) => [...r]);

        const after2 = syncMaybeTwoScatters(
            namesGrid,
            weightsGrid,
            board,
            mults,
            xw.xWaysReplacementSymbol,
            PAYOUTS,
            NUM_REELS,
            VISIBLE_ROWS
        );

        const bonusWin = calculateWin(1.0, after2.namesGrid, after2.weightsGrid);
        totalBonusWin += bonusWin;

        const windowStartReel = 5 - bonusScatterCount;
        const windows = {};
        for (let reel = windowStartReel; reel < NUM_REELS; reel++) {
            windows[reel] = after2.namesGrid[reel][VISIBLE_ROWS - 1];
        }

        const bonusSpinSeed = makeSpinSeed(parentBookId, spin + 1, after2.namesGrid, after2.weightsGrid);

        const spinRecord = {
            seed: bonusSpinSeed,
            winMultiplier: winMultiplier(bonusWin, 1.0),
            reel0: after2.namesGrid[0].map((s) => SYMBOLS.indexOf(s)),
            reel1: after2.namesGrid[1].map((s) => SYMBOLS.indexOf(s)),
            reel2: after2.namesGrid[2].map((s) => SYMBOLS.indexOf(s)),
            reel3: after2.namesGrid[3].map((s) => SYMBOLS.indexOf(s)),
            reel4: after2.namesGrid[4].map((s) => SYMBOLS.indexOf(s)),
            weights: after2.weightsGrid,
            win: bonusWin,
            modifier: null,
            windows
        };
        for (let r = 0; r < NUM_REELS; r++) {
            spinRecord[`landingReel${r}`] = landingReels[r];
        }
        bonusSpins.push(spinRecord);
    }

    return { bonusSpins, totalBonusWin };
}

/** Минимальный фри-спин (без выплат). */
function buildMinimalBonusSpin(bonusScatterCount, parentBookId, spinIndex, ctx) {
    const {
        SYMBOLS,
        NUM_REELS,
        VISIBLE_ROWS,
        calculateWin,
        winMultiplier,
        makeSpinSeed
    } = ctx;

    const lowIx = SYMBOLS.indexOf('low1');
    const landingIndices = Array.from({ length: NUM_REELS }, () => [lowIx, lowIx, lowIx]);
    const board = landingIndices.map((reel) => reel.map((i) => SYMBOLS[i]));
    const mults = Array.from({ length: NUM_REELS }, () => [1, 1, 1]);
    const namesGrid = board.map((r) => [...r]);
    const weightsGrid = mults.map((r) => [...r]);
    const bonusWin = calculateWin(1.0, namesGrid, weightsGrid);

    const windowStartReel = 5 - bonusScatterCount;
    const windows = {};
    for (let reel = windowStartReel; reel < NUM_REELS; reel++) {
        windows[reel] = namesGrid[reel][VISIBLE_ROWS - 1];
    }

    const bonusSpinSeed = makeSpinSeed(parentBookId, spinIndex + 1, namesGrid, weightsGrid);
    const spinRecord = {
        seed: bonusSpinSeed,
        winMultiplier: winMultiplier(bonusWin, 1.0),
        reel0: namesGrid[0].map((s) => SYMBOLS.indexOf(s)),
        reel1: namesGrid[1].map((s) => SYMBOLS.indexOf(s)),
        reel2: namesGrid[2].map((s) => SYMBOLS.indexOf(s)),
        reel3: namesGrid[3].map((s) => SYMBOLS.indexOf(s)),
        reel4: namesGrid[4].map((s) => SYMBOLS.indexOf(s)),
        weights: weightsGrid,
        win: bonusWin,
        modifier: null,
        windows
    };
    for (let r = 0; r < NUM_REELS; r++) {
        spinRecord[`landingReel${r}`] = landingIndices[r];
    }
    return { spinRecord, bonusWin };
}

/**
 * Синтетический максвин-спин: xWays на верхнем ряду, split под ними → high5 + множители.
 * landing в файле = до resolve (xWays/split), reel* = после resolve (high5).
 */
function buildSyntheticMaxWinBonusSpin(
    bonusScatterCount,
    parentBookId,
    spinIndex,
    ctx,
    targetMinWin = 41500
) {
    const {
        SYMBOLS,
        NUM_REELS,
        VISIBLE_ROWS,
        calculateWin,
        winMultiplier,
        makeSpinSeed
    } = ctx;

    const xWaysIx = SYMBOLS.indexOf('xWays');
    const splitIx = SYMBOLS.indexOf('split');
    const lowIx = SYMBOLS.indexOf('low1');

    let bonusWin = 0;
    let namesGrid = null;
    let weightsGrid = null;
    let landingIndices = null;

    for (let xMult = 6; xMult <= 7; xMult++) {
        for (let addRow1 = 0; addRow1 <= 1; addRow1++) {
            landingIndices = Array.from({ length: NUM_REELS }, () => [xWaysIx, lowIx, splitIx]);
            const board = landingIndices.map((reel) => reel.map((i) => SYMBOLS[i]));
            const mults = Array.from({ length: NUM_REELS }, () => [1, 1, 1]);
            const bonusEnhancerMults = [2, 2, 2, 2, 2];

            syncResolveSplits(board, mults, bonusEnhancerMults, NUM_REELS);

            for (let r = 0; r < NUM_REELS; r++) {
                board[r][0] = 'high5';
                mults[r][0] = xMult;
                if (addRow1) {
                    board[r][1] = 'high5';
                    mults[r][1] = 2;
                }
            }

            namesGrid = board.map((row) => [...row]);
            weightsGrid = mults.map((row) => [...row]);
            bonusWin = calculateWin(1.0, namesGrid, weightsGrid);
            if (bonusWin >= targetMinWin) break;
        }
        if (bonusWin >= targetMinWin) break;
    }

    const windowStartReel = 5 - bonusScatterCount;
    const windows = {};
    for (let reel = windowStartReel; reel < NUM_REELS; reel++) {
        windows[reel] = namesGrid[reel][VISIBLE_ROWS - 1];
    }

    const bonusSpinSeed = makeSpinSeed(parentBookId, spinIndex + 1, namesGrid, weightsGrid);
    const spinRecord = {
        seed: bonusSpinSeed,
        winMultiplier: winMultiplier(bonusWin, 1.0),
        reel0: namesGrid[0].map((s) => SYMBOLS.indexOf(s)),
        reel1: namesGrid[1].map((s) => SYMBOLS.indexOf(s)),
        reel2: namesGrid[2].map((s) => SYMBOLS.indexOf(s)),
        reel3: namesGrid[3].map((s) => SYMBOLS.indexOf(s)),
        reel4: namesGrid[4].map((s) => SYMBOLS.indexOf(s)),
        weights: weightsGrid,
        win: bonusWin,
        modifier: null,
        windows
    };
    for (let r = 0; r < NUM_REELS; r++) {
        spinRecord[`landingReel${r}`] = landingIndices[r];
    }

    return { spinRecord, bonusWin };
}

module.exports = {
    simulateBonusGame,
    simulateBaseSpinOutcome,
    buildMinimalBonusSpin,
    buildSyntheticMaxWinBonusSpin
};
