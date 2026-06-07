'use strict';

const BASE_REEL_ROWS = [2, 3, 4, 4, 3, 2];
const NUM_REELS = 6;
const BOOK_BONUS_FREE_SPINS = 7;

function parseReelGroups(enc, expectedRows) {
  const reelGroups = enc.split('|').map((g) =>
    g.split(',').map((x) => Number(String(x).trim()))
  );
  if (reelGroups.length !== NUM_REELS) return null;
  for (let r = 0; r < NUM_REELS; r++) {
    if (reelGroups[r].length !== expectedRows[r]) return null;
    for (const ix of reelGroups[r]) {
      if (!Number.isFinite(ix) || ix < 0) return null;
    }
  }
  return reelGroups;
}

function spinFromEncodedParts(reelsEnc, weightsEnc, nudgeEnc, seedLabel, rows) {
  const reelGroups = parseReelGroups(reelsEnc, rows);
  const weightGroups = parseReelGroups(weightsEnc, rows);
  if (!reelGroups || !weightGroups) return null;

  const nudgeParts = String(nudgeEnc || '').split(',').map((x) => Number(String(x).trim()));
  if (nudgeParts.length !== NUM_REELS || nudgeParts.some((n) => !Number.isFinite(n) || n < 1)) {
    return null;
  }

  const spin = {
    seed: seedLabel,
    weights: [],
    reelNudgeMult: nudgeParts,
    win: 0,
    winMultiplier: 0
  };

  for (let r = 0; r < NUM_REELS; r++) {
    spin[`reel${r}`] = reelGroups[r];
    spin.weights[r] = weightGroups[r];
  }
  return spin;
}

function parseBookLine(trimmed, scatterIx = 11) {
  if (!trimmed || trimmed.startsWith('#')) return null;
  const cols = trimmed.split('\t');
  if (cols.length < 6) return null;

  const seed = cols[0].trim();
  const totalWinAtBet1 = Number(cols[1]);
  const hasBonusMeta = cols[2].trim() === '1';

  const spin = spinFromEncodedParts(cols[3], cols[4], cols[5], seed, BASE_REEL_ROWS);
  if (!spin || !seed) return null;

  let scatterOnBase = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
      if (spin[`reel${r}`][row] === scatterIx) scatterOnBase++;
    }
  }

  let bonusSpins = [];
  if (hasBonusMeta && scatterOnBase >= 3 && cols.length >= 7) {
    const n = Number(cols[6]);
    if (n === BOOK_BONUS_FREE_SPINS && cols.length >= 7 + n * 3) {
      let ci = 7;
      let ok = true;
      for (let i = 0; i < n; i++) {
        const bonusRows = scatterOnBase >= 4
          ? BASE_REEL_ROWS.slice()
          : BASE_REEL_ROWS.map((h, ri) => (ri === 2 ? 8 : h));
        const bs = spinFromEncodedParts(cols[ci++], cols[ci++], cols[ci++], `${seed}_b${i + 1}`, bonusRows);
        if (!bs) {
          ok = false;
          break;
        }
        bonusSpins.push(bs);
      }
      if (!ok || bonusSpins.length !== n) bonusSpins = [];
    }
  }

  return {
    seed,
    hasBonus: hasBonusMeta && bonusSpins.length > 0,
    totalWin: totalWinAtBet1,
    totalWinMultiplier: totalWinAtBet1,
    scatterCount: scatterOnBase,
    spin,
    bonusSpins
  };
}

function parseHeaderMeta(text) {
  const meta = {
    rtp: null,
    hitRate: null,
    bonusRate: null,
    jackpotSeed: '',
    buyScatter: null,
    buyCostMult: null
  };
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t.startsWith('#')) continue;
    const rtpM = t.match(/^#\s*RTP_ALL_SEEDS:\s*([\d.]+)%/);
    if (rtpM) meta.rtp = Number(rtpM[1]);
    const hitM = t.match(/^#\s*HIT_RATE:\s*([\d.]+)%/);
    if (hitM) meta.hitRate = Number(hitM[1]);
    const bonusM = t.match(/^#\s*BONUS_RATE:\s*([\d.]+)%/);
    if (bonusM) meta.bonusRate = Number(bonusM[1]);
    const jpM = t.match(/^#\s*JACKPOT_SEED:\s*(\S+)/);
    if (jpM) meta.jackpotSeed = jpM[1];
    const buySM = t.match(/^#\s*BUY_SCATTER:\s*(\d+)/);
    if (buySM) meta.buyScatter = Number(buySM[1]);
    const buyCM = t.match(/^#\s*BUY_COST_MULT:\s*([\d.]+)/);
    if (buyCM) meta.buyCostMult = Number(buyCM[1]);
  }
  return meta;
}

module.exports = {
  BASE_REEL_ROWS,
  NUM_REELS,
  parseBookLine,
  parseHeaderMeta
};
