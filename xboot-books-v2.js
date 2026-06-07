'use strict';

/**
 * BOOKS_XBOOT_V2 — фиксированная бинарная запись 64 B.
 * Бонусные 7 фри не хранятся: воспроизводятся simulateBonusGame(bookId).
 */

const fs = require('fs');
const path = require('path');

const {
  SYMBOLS,
  BASE_REEL_ROWS,
  NUM_REELS,
  makeSpinSeed,
  simulateBonusGame,
  winMultiplier
} = require('./xboot-slot-sim.js');

const MAGIC = Buffer.from('XB02');
const VERSION = 2;
const RECORD_SIZE = 64;
const DEFAULT_SHARD_SIZE = 1_000_000;
const FLAG_HAS_BONUS = 1;
const FLAG_SCATTER4 = 2;
const FLAG_JACKPOT = 4;

const CELL_COUNT = BASE_REEL_ROWS.reduce((s, n) => s + n, 0);

function cellLayout() {
  const cells = [];
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
      cells.push({ reel: r, row });
    }
  }
  return cells;
}

const CELLS = cellLayout();

function encodeRecord(book) {
  const buf = Buffer.alloc(RECORD_SIZE);
  const id = Number(book.id) >>> 0;
  const scatter = Number(book.scatterCount) || 0;
  let flags = 0;
  if (book.hasBonus) flags |= FLAG_HAS_BONUS;
  if (scatter >= 4) flags |= FLAG_SCATTER4;
  if (book.isJackpot) flags |= FLAG_JACKPOT;

  buf.writeUInt32LE(id, 0);
  buf.writeUInt8(flags, 4);
  buf.writeUInt8(Math.min(255, scatter), 5);
  buf.writeFloatLE(Number(book.spin?.win) || 0, 8);
  buf.writeFloatLE(Number(book.totalWin) || 0, 12);
  buf.writeFloatLE(Number(book.bonusWin) || 0, 16);

  const ix = book.spin?.reelIndices || [];
  const wg = book.spin?.weights || [];
  const nudge = book.spin?.reelNudgeMult || [1, 1, 1, 1, 1, 1];

  let ci = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
      buf.writeUInt8(Math.min(255, Number(ix[r]?.[row]) || 0), 20 + ci);
      buf.writeUInt8(Math.min(255, Math.max(1, Number(wg[r]?.[row]) || 1)), 20 + CELL_COUNT + ci);
      ci++;
    }
  }
  for (let r = 0; r < NUM_REELS; r++) {
    buf.writeUInt8(Math.min(255, Math.max(1, Number(nudge[r]) || 1)), 20 + CELL_COUNT * 2 + r);
  }

  return buf;
}

function decodeRecord(buf, offset = 0, globalId = null) {
  if (buf.length < offset + RECORD_SIZE) return null;
  if (!buf.slice(offset, offset + 4).equals(MAGIC) && offset === 0 && buf.length >= 4) {
    /* shard file has no per-record magic */
  }

  const id = buf.readUInt32LE(offset);
  const flags = buf.readUInt8(offset + 4);
  const scatterCount = buf.readUInt8(offset + 5);
  const baseWin = buf.readFloatLE(offset + 8);
  const totalWin = buf.readFloatLE(offset + 12);
  const bonusWin = buf.readFloatLE(offset + 16);

  const reelIndices = [];
  const weights = [];
  let ci = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    reelIndices[r] = [];
    weights[r] = [];
    for (let row = 0; row < BASE_REEL_ROWS[r]; row++) {
      reelIndices[r][row] = buf.readUInt8(offset + 20 + ci);
      weights[r][row] = buf.readUInt8(offset + 20 + CELL_COUNT + ci);
      ci++;
    }
  }
  const reelNudgeMult = [];
  for (let r = 0; r < NUM_REELS; r++) {
    reelNudgeMult[r] = buf.readUInt8(offset + 20 + CELL_COUNT * 2 + r) || 1;
  }

  const bookId = globalId != null ? globalId : id;
  const seed = makeSpinSeed(bookId, 0, reelIndices, weights, 'xb');
  const spin = {
    seed,
    win: baseWin,
    winMultiplier: winMultiplier(baseWin, 1),
    reelIndices,
    weights,
    reelNudgeMult
  };
  for (let r = 0; r < NUM_REELS; r++) {
    spin[`reel${r}`] = reelIndices[r];
  }

  const hasBonus = !!(flags & FLAG_HAS_BONUS);
  const isJackpot = !!(flags & FLAG_JACKPOT);
  let bonusSpins = [];

  if (isJackpot) {
    const { buildSyntheticMaxWinBook } = require('./jackpot-boards.js');
    const jp = buildSyntheticMaxWinBook(bookId, { seedIdPrefix: 'xb' });
    bonusSpins = (jp.bonusSpins || []).map((bs) => {
      const rec = { ...bs };
      for (let r = 0; r < NUM_REELS; r++) rec[`reel${r}`] = bs.reelIndices[r];
      return rec;
    });
    spin.win = baseWin;
    spin.winMultiplier = winMultiplier(baseWin, 1);
  } else if (hasBonus && scatterCount >= 3) {
    const sim = simulateBonusGame(
      scatterCount,
      bookId,
      (bId, tag, ri, wg, prefix) => makeSpinSeed(bId, tag, ri, wg, prefix || 'xb')
    );
    bonusSpins = sim.bonusSpins.map((bs) => {
      const rec = { ...bs };
      for (let r = 0; r < NUM_REELS; r++) rec[`reel${r}`] = bs.reelIndices[r];
      return rec;
    });
  }

  return {
    id: bookId,
    seed,
    hasBonus: hasBonus && bonusSpins.length > 0,
    isJackpot,
    scatterCount,
    totalWin,
    totalWinMultiplier: totalWin,
    bonusWin,
    spin,
    bonusSpins
  };
}

function shardIdForBook(globalBookId, shardSize = DEFAULT_SHARD_SIZE) {
  return Math.floor(Number(globalBookId) / shardSize);
}

function localIndexInShard(globalBookId, shardSize = DEFAULT_SHARD_SIZE) {
  return Number(globalBookId) % shardSize;
}

function recordOffset(localIndex) {
  return Number(localIndex) * RECORD_SIZE;
}

function writeShardHeader(fd) {
  const hdr = Buffer.alloc(16);
  MAGIC.copy(hdr, 0);
  hdr.writeUInt16LE(VERSION, 4);
  hdr.writeUInt16LE(RECORD_SIZE, 6);
  hdr.writeUInt32LE(0, 8);
  hdr.writeUInt32LE(0, 12);
  fs.writeSync(fd, hdr, 0, hdr.length, 0);
}

const SHARD_HEADER_SIZE = 16;

function shardDataOffset(localIndex) {
  return SHARD_HEADER_SIZE + recordOffset(localIndex);
}

function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

function readMeta(metaPath) {
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

function spinRecordToClientSpin(spin) {
  const out = {
    seed: spin.seed,
    win: spin.win,
    winMultiplier: spin.winMultiplier,
    weights: spin.weights,
    reelNudgeMult: spin.reelNudgeMult
  };
  for (let r = 0; r < NUM_REELS; r++) {
    out[`reel${r}`] = spin.reelIndices?.[r] || spin[`reel${r}`];
  }
  return out;
}

function entryToClientFormat(entry) {
  return {
    seed: entry.seed,
    hasBonus: entry.hasBonus,
    isJackpot: entry.isJackpot,
    scatterCount: entry.scatterCount,
    totalWin: entry.totalWin,
    totalWinMultiplier: entry.totalWin,
    spin: spinRecordToClientSpin(entry.spin),
    bonusSpins: (entry.bonusSpins || []).map(spinRecordToClientSpin)
  };
}

module.exports = {
  MAGIC,
  VERSION,
  RECORD_SIZE,
  SHARD_HEADER_SIZE,
  DEFAULT_SHARD_SIZE,
  CELL_COUNT,
  FLAG_HAS_BONUS,
  FLAG_SCATTER4,
  FLAG_JACKPOT,
  SYMBOLS,
  BASE_REEL_ROWS,
  NUM_REELS,
  encodeRecord,
  decodeRecord,
  shardIdForBook,
  localIndexInShard,
  recordOffset,
  shardDataOffset,
  writeShardHeader,
  writeMeta,
  readMeta,
  entryToClientFormat,
  spinRecordToClientSpin
};
