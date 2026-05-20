'use strict';

/** Парсинг одной строки BOOKS_SEEDS_V2 (общий для books-server и slot.js). */
const SYMBOLS = ['low1', 'low2', 'low3', 'low4', 'low5', 'high1', 'high2', 'high3', 'high4', 'high5', 'wild', 'scatter', 'xWays', 'split', 'split_wilds'];
const NUM_REELS = 5;
const VISIBLE_ROWS = 3;
const BOOKS_MAX_SYM_INDEX_INCLUSIVE = SYMBOLS.indexOf('split_wilds');
const BOOK_BONUS_FREE_SPINS_BY_SCATTER = { 3: 7, 4: 8, 5: 10 };

function spinFromEncodedParts(reelsEnc, weightsEnc, seedLabel = '') {
    const reelGroups = reelsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    const weightGroups = weightsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    if (reelGroups.length !== NUM_REELS || weightGroups.length !== NUM_REELS) return null;
    for (let r = 0; r < NUM_REELS; r++) {
        if (reelGroups[r].length !== VISIBLE_ROWS || weightGroups[r].length !== VISIBLE_ROWS) return null;
    }
    const spin = { seed: seedLabel, weights: [], win: 0, winMultiplier: 0 };
    for (let r = 0; r < NUM_REELS; r++) {
        spin[`reel${r}`] = reelGroups[r];
        spin.weights[r] = weightGroups[r];
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const ix = reelGroups[r][row];
            if (!(Number.isFinite(ix)) || ix < 0 || ix > BOOKS_MAX_SYM_INDEX_INCLUSIVE) return null;
        }
    }
    return spin;
}

function reelIndicesFromEncodedReels(reelsEnc) {
    const reelGroups = reelsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    if (reelGroups.length !== NUM_REELS) return null;
    for (let r = 0; r < NUM_REELS; r++) {
        if (reelGroups[r].length !== VISIBLE_ROWS) return null;
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const ix = reelGroups[r][row];
            if (!(Number.isFinite(ix)) || ix < 0 || ix > BOOKS_MAX_SYM_INDEX_INCLUSIVE) return null;
        }
    }
    return reelGroups;
}

/**
 * @param {string} trimmed одна строка TAB (без #)
 * @returns {object|null}
 */
function parseBookLine(trimmed) {
    if (!trimmed || trimmed.startsWith('#')) return null;
    const cols = trimmed.split('\t');
    if (cols.length < 5) return null;

    const seed = cols[0].trim();
    const totalWinAtBet1 = Number(cols[1]);
    const hasBonusMeta = cols[2].trim() === '1';
    const scatterIx = SYMBOLS.indexOf('scatter');

    const spin = spinFromEncodedParts(cols[3], cols[4], seed);
    if (!spin || !seed) return null;

    let scatterOnBase = 0;
    for (let r = 0; r < NUM_REELS; r++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (spin[`reel${r}`][row] === scatterIx) scatterOnBase++;
        }
    }

    let bonusSpins = [];
    if (hasBonusMeta && scatterOnBase >= 3) {
        const need = BOOK_BONUS_FREE_SPINS_BY_SCATTER[scatterOnBase];
        const n = Number(cols[5]);
        if (need && n === need && cols.length >= 6 + need * 2) {
            const tailCols = cols.length - 6;
            const colsPerSpin = tailCols / need;
            const hasLandingCol = colsPerSpin >= 3 && cols.length >= 6 + need * 3;

            let ci = 6;
            let ok = true;
            for (let i = 0; i < n; i++) {
                const bs = spinFromEncodedParts(cols[ci++], cols[ci++], `${seed}_b${i + 1}`);
                if (!bs) {
                    ok = false;
                    break;
                }
                if (hasLandingCol) {
                    const landing = reelIndicesFromEncodedReels(cols[ci++]);
                    if (!landing) {
                        ok = false;
                        break;
                    }
                    for (let r = 0; r < NUM_REELS; r++) {
                        bs[`landingReel${r}`] = landing[r];
                    }
                }
                bonusSpins.push(bs);
            }
            if (!ok || bonusSpins.length !== n) bonusSpins = [];
        }
    }

    return {
        seed,
        hasBonus: hasBonusMeta,
        totalWin: totalWinAtBet1,
        totalWinMultiplier: totalWinAtBet1,
        spin,
        bonusSpins
    };
}

function parseHeaderMeta(text) {
    const meta = { rtp: null, jackpotSeed: '' };
    for (const raw of text.split(/\r?\n/)) {
        const t = raw.trim();
        if (!t.startsWith('#')) continue;
        const rtpM = t.match(/^#\s*RTP_ALL_SEEDS:\s*([\d.]+)%/);
        if (rtpM) meta.rtp = Number(rtpM[1]);
        const jpM = t.match(/^#\s*BUY_JACKPOT_SEED:\s*(\S+)/);
        if (jpM) meta.jackpotSeed = jpM[1];
    }
    return meta;
}

module.exports = {
    SYMBOLS,
    NUM_REELS,
    VISIBLE_ROWS,
    BOOK_BONUS_FREE_SPINS_BY_SCATTER,
    parseBookLine,
    parseHeaderMeta
};
