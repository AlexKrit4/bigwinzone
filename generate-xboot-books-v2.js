'use strict';

/**
 * Генератор BOOKS_XBOOT_V2: бинарные шарды, корзины RTP, один scale-pass.
 * Пилот: 1M книг (~64 MB data). Полный: --full → 66M.
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');

const {
  RECORD_SIZE,
  SHARD_HEADER_SIZE,
  DEFAULT_SHARD_SIZE,
  decodeRecord,
  writeMeta,
  readMeta
} = require('./xboot-books-v2.js');

const PILOT_BOOKS = 1_000_000;
const FULL_BOOKS = 66_000_000;
const TARGET_RTP_PCT = 96.03;
const TARGET_HIT_RATE = 0.2217;
const TARGET_BONUS_RATE = 1 / 211;
const WORKER_COUNT = Math.min(8, Math.max(1, (os.cpus()?.length || 4) - 1));

const OUT_DIR = path.join(__dirname, 'games', 'xboot', 'books-v2');
const WORKER_SCRIPT = path.join(__dirname, 'generate-xboot-books-v2-worker.js');

function parseArgs() {
  const full = process.argv.includes('--full');
  const books = full ? FULL_BOOKS : PILOT_BOOKS;
  const jackpotId = full ? 33_000_000 : 888_888;
  return { full, books, jackpotId, shardSize: DEFAULT_SHARD_SIZE };
}

function shuffleInPlace(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildBucketPlan(totalBooks, jackpotId) {
  const buckets = new Array(totalBooks).fill('miss');
  const targetHits = Math.round(totalBooks * TARGET_HIT_RATE);
  const targetBonuses = Math.round(totalBooks * TARGET_BONUS_RATE);
  const bonus4Count = Math.max(1, Math.round(targetBonuses * 0.12));
  const bonus3Count = Math.max(0, targetBonuses - bonus4Count);
  const hitNoBonus = Math.max(0, targetHits - targetBonuses);

  const slots = [];
  for (let i = 0; i < hitNoBonus; i++) slots.push('hit');
  for (let i = 0; i < bonus3Count; i++) slots.push('bonus3');
  for (let i = 0; i < bonus4Count; i++) slots.push('bonus4');
  shuffleInPlace(slots);

  let slotIdx = 0;
  const indices = Array.from({ length: totalBooks }, (_, i) => i);
  shuffleInPlace(indices);
  for (const idx of indices) {
    if (idx === jackpotId) continue;
    if (slotIdx < slots.length) {
      buckets[idx] = slots[slotIdx++];
    }
  }

  buckets[jackpotId] = 'jackpot';
  return buckets;
}

function shardJobs(totalBooks, shardSize) {
  const jobs = [];
  const shardCount = Math.ceil(totalBooks / shardSize);
  for (let s = 0; s < shardCount; s++) {
    const startId = s * shardSize;
    const count = Math.min(shardSize, totalBooks - startId);
    jobs.push({ shardId: s, startId, count });
  }
  return jobs;
}

function runWorker(job, bucketsSlice, config) {
  const shardPath = path.join(OUT_DIR, `shard_${String(job.shardId).padStart(3, '0')}.bin`);
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SCRIPT, {
      workerData: {
        shardPath,
        shardId: job.shardId,
        startId: job.startId,
        count: job.count,
        buckets: bucketsSlice,
        config: { seedIdPrefix: 'xb' }
      }
    });
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        console.log(`  shard ${msg.shardId}: ${msg.written}/${msg.count}`);
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`worker shard ${job.shardId} exit ${code}`));
      else resolve({ ...job, shardPath });
    });
  });
}

async function generateShards(totalBooks, shardSize, buckets, config) {
  const jobs = shardJobs(totalBooks, shardSize);
  const queue = [...jobs];
  const active = new Set();
  const results = [];

  async function pump() {
    while (active.size < WORKER_COUNT && queue.length) {
      const job = queue.shift();
      const slice = buckets.slice(job.startId, job.startId + job.count);
      const p = runWorker(job, slice, config).then((r) => {
        active.delete(p);
        results.push(r);
        return pump();
      });
      active.add(p);
    }
    if (active.size) await Promise.race(active);
    if (queue.length || active.size) return pump();
  }

  await pump();
  return results.sort((a, b) => a.shardId - b.shardId);
}

function sumWinsFromShards(shardPaths, jackpotId) {
  let sumWin = 0;
  let count = 0;
  const { decodeRecord } = require('./xboot-books-v2.js');

  for (const { shardPath, startId, count: c } of shardPaths) {
    const fd = fs.openSync(shardPath, 'r');
    const chunk = Buffer.alloc(RECORD_SIZE * 4096);
    for (let base = 0; base < c; base += 4096) {
      const batch = Math.min(4096, c - base);
      const byteLen = batch * RECORD_SIZE;
      const off = SHARD_HEADER_SIZE + base * RECORD_SIZE;
      fs.readSync(fd, chunk, 0, byteLen, off);
      for (let i = 0; i < batch; i++) {
        const globalId = startId + base + i;
        if (globalId === jackpotId) continue;
        const rec = decodeRecord(chunk, i * RECORD_SIZE, globalId);
        if (!rec) continue;
        sumWin += Number(rec.totalWin) || 0;
        count++;
      }
    }
    fs.closeSync(fd);
  }
  return { sumWin, count };
}

const FLAG_HAS_BONUS = 1;

function computeMetricsFromShards(shardPaths, totalBooks, jackpotId) {
  let sumWin = 0;
  let hits = 0;
  let bonuses = 0;
  let count = 0;

  for (const { shardPath, startId, count: c } of shardPaths) {
    const fd = fs.openSync(shardPath, 'r');
    const chunk = Buffer.alloc(RECORD_SIZE * 4096);
    for (let base = 0; base < c; base += 4096) {
      const batch = Math.min(4096, c - base);
      const byteLen = batch * RECORD_SIZE;
      const off = SHARD_HEADER_SIZE + base * RECORD_SIZE;
      fs.readSync(fd, chunk, 0, byteLen, off);
      for (let i = 0; i < batch; i++) {
        const globalId = startId + base + i;
        if (globalId === jackpotId) continue;
        const row = i * RECORD_SIZE;
        const tw = chunk.readFloatLE(row + 12);
        const flags = chunk.readUInt8(row + 4);
        count++;
        sumWin += tw;
        if (tw > 0.0001) hits++;
        if (flags & FLAG_HAS_BONUS) bonuses++;
      }
    }
    fs.closeSync(fd);
  }

  return {
    count,
    sumWin,
    rtp: count > 0 ? (sumWin / count) * 100 : 0,
    hitRate: count > 0 ? hits / count : 0,
    bonusRate: count > 0 ? bonuses / count : 0,
    hits,
    bonuses
  };
}

/** Топ-N hit-книг без полного скана 66M в память (для RTP-подгонки). */
function collectTopHitBooks(shardPaths, jackpotId, limit = 8000) {
  const cap = Math.max(1, Number(limit) || 8000);
  const top = [];

  const insertHit = (id, totalWin) => {
    if (totalWin <= 0.0001) return;
    if (top.length < cap) {
      top.push({ id, totalWin });
      if (top.length === cap) top.sort((a, b) => b.totalWin - a.totalWin);
      return;
    }
    if (totalWin <= top[top.length - 1].totalWin) return;
    let lo = 0;
    let hi = top.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (top[mid].totalWin >= totalWin) lo = mid + 1;
      else hi = mid;
    }
    top.splice(lo, 0, { id, totalWin });
    if (top.length > cap) top.length = cap;
  };

  for (const { shardPath, startId, count: c } of shardPaths) {
    const fd = fs.openSync(shardPath, 'r');
    const chunk = Buffer.alloc(RECORD_SIZE * 4096);
    for (let base = 0; base < c; base += 4096) {
      const batch = Math.min(4096, c - base);
      const byteLen = batch * RECORD_SIZE;
      const off = SHARD_HEADER_SIZE + base * RECORD_SIZE;
      fs.readSync(fd, chunk, 0, byteLen, off);
      for (let i = 0; i < batch; i++) {
        const globalId = startId + base + i;
        if (globalId === jackpotId) continue;
        const totalWin = chunk.readFloatLE(i * RECORD_SIZE + 12);
        insertHit(globalId, totalWin);
      }
    }
    fs.closeSync(fd);
  }

  top.sort((a, b) => b.totalWin - a.totalWin);
  return top;
}

function writeMissBookAt(shardPaths, shardSize, globalId) {
  const { makeGenuineMissOutcome, makeSpinSeed } = require('./xboot-slot-sim.js');
  const { encodeRecord } = require('./xboot-books-v2.js');
  const miss = makeGenuineMissOutcome(globalId);
  const landingIndices = miss.landingIndices;
  const outcome = miss.outcome;
  const seed = makeSpinSeed(globalId, 0, landingIndices, outcome.mults.map((col) => [...col]), 'xb');
  const book = {
    id: globalId,
    hasBonus: false,
    isJackpot: false,
    scatterCount: outcome.scatters,
    spin: {
      seed,
      win: outcome.win,
      reelIndices: landingIndices,
      weights: outcome.mults.map((col) => [...col]),
      reelNudgeMult: outcome.reelNudgeMult.slice()
    },
    bonusWin: 0,
    totalWin: outcome.win
  };
  const shard = shardPaths.find((s) => globalId >= s.startId && globalId < s.startId + s.count);
  const local = globalId - shard.startId;
  const fd = fs.openSync(shard.shardPath, 'r+');
  const buf = encodeRecord(book);
  fs.writeSync(fd, buf, 0, RECORD_SIZE, SHARD_HEADER_SIZE + local * RECORD_SIZE);
  fs.closeSync(fd);
}

/** Подгонка RTP без scale-pass: крупные hit → miss (доска и totalWin совпадают). */
function rtpTunePass(shardPaths, totalBooks, jackpotId, shardSize, targetRtpPct) {
  const RTP_TOL = 0.55;
  let metrics = computeMetricsFromShards(shardPaths, totalBooks, jackpotId);
  let pass = 0;

  while (metrics.rtp > targetRtpPct + RTP_TOL && pass < 40) {
    const excess = ((metrics.rtp - targetRtpPct) / 100) * metrics.count;
    const batch = Math.min(3000, Math.max(80, Math.ceil(excess / 3)));
    const hits = collectTopHitBooks(shardPaths, jackpotId, Math.max(batch * 3, 8000));
    if (!hits.length) break;

    console.log(`  RTP-коррекция ${pass + 1}: ${metrics.rtp.toFixed(2)}% → demote ${batch} hit`);
    for (let k = 0; k < batch && k < hits.length; k++) {
      writeMissBookAt(shardPaths, shardSize, hits[k].id);
    }
    metrics = computeMetricsFromShards(shardPaths, totalBooks, jackpotId);
    pass++;
  }

  return metrics;
}

async function main() {
  const { full, books, jackpotId, shardSize } = parseArgs();
  const t0 = Date.now();

  console.log('='.repeat(60));
  console.log(`BOOKS_XBOOT_V2 — ${full ? 'FULL 66M' : 'PILOT 1M'}`);
  console.log(`Книг: ${books}, шард: ${shardSize}, воркеров: ${WORKER_COUNT}`);
  console.log(`Выход: ${OUT_DIR}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n1) Корзины RTP…');
  const buckets = buildBucketPlan(books, jackpotId);
  const bonusN = buckets.filter((b) => b === 'bonus3' || b === 'bonus4').length;
  const hitN = buckets.filter((b) => b === 'hit').length;
  console.log(`   miss=${buckets.filter((b) => b === 'miss').length} hit=${hitN} bonus=${bonusN} jackpot@${jackpotId}`);

  console.log('\n2) Потоковая генерация шардов…');
  const shardResults = await generateShards(books, shardSize, buckets, {});

  const shardPaths = shardResults.map((r) => ({
    shardPath: r.shardPath,
    startId: r.startId,
    count: r.count
  }));

  console.log('\n3) Метрики после генерации…');
  let metrics = computeMetricsFromShards(shardPaths, books, jackpotId);
  console.log(`   RTP ${metrics.rtp.toFixed(4)}% | hit ${(metrics.hitRate * 100).toFixed(2)}% | bonus ${(metrics.bonusRate * 100).toFixed(3)}%`);

  console.log('\n4) RTP-подгонка (без scale-pass, hit→miss)…');
  metrics = rtpTunePass(shardPaths, books, jackpotId, shardSize, TARGET_RTP_PCT);
  console.log(`   RTP ${metrics.rtp.toFixed(4)}% | hit ${(metrics.hitRate * 100).toFixed(2)}% | bonus ${(metrics.bonusRate * 100).toFixed(3)}%`);

  const jpShard = shardPaths.find((s) => jackpotId >= s.startId && jackpotId < s.startId + s.count);
  const jpFd = fs.openSync(jpShard.shardPath, 'r');
  const jpBuf = Buffer.alloc(RECORD_SIZE);
  fs.readSync(jpFd, jpBuf, 0, RECORD_SIZE, SHARD_HEADER_SIZE + (jackpotId % shardSize) * RECORD_SIZE);
  fs.closeSync(jpFd);
  const jackpotRec = decodeRecord(jpBuf, 0, jackpotId);

  const meta = {
    format: 'BOOKS_XBOOT_V2',
    version: 2,
    totalBooks: books,
    shardSize,
    recordSize: RECORD_SIZE,
    targetRtpPct: TARGET_RTP_PCT,
    hitRatePct: +(metrics.hitRate * 100).toFixed(4),
    bonusRatePct: +(metrics.bonusRate * 100).toFixed(4),
    measuredRtpPct: +metrics.rtp.toFixed(4),
    jackpotBookId: jackpotId,
    jackpotSeed: jackpotRec?.seed || '',
    shards: shardPaths.map((s, i) => ({
      id: i,
      file: path.basename(s.shardPath),
      startId: s.startId,
      count: s.count
    }))
  };

  writeMeta(path.join(OUT_DIR, 'meta.json'), meta);

  const dataBytes = books * RECORD_SIZE + shardPaths.length * SHARD_HEADER_SIZE;
  console.log('\n' + '='.repeat(60));
  console.log('Готово:', OUT_DIR);
  console.log(`meta.json + ${shardPaths.length} шард(ов), ~${(dataBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Джекпот: id=${jackpotId} seed=${meta.jackpotSeed}`);
  console.log(`Время: ${((Date.now() - t0) / 1000).toFixed(1)} с`);
  console.log('='.repeat(60));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, buildBucketPlan, parseArgs };
