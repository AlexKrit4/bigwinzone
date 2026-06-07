'use strict';

/**
 * BOOKS_XBOOT_V2 buy: 3M книг покупки 3 scatter и 3M — 4 scatter.
 * Без синтетического максвина (totalWin < 55200×).
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');

const {
  RECORD_SIZE,
  SHARD_HEADER_SIZE,
  DEFAULT_SHARD_SIZE,
  writeMeta
} = require('./xboot-books-v2.js');

const TOTAL_BUY_BOOKS = 3_000_000;
const BUY_SCATTER3_COST_MULT = 75;
const BUY_SCATTER4_COST_MULT = 350;
const TARGET_RTP_PCT = 96.03;
const WORKER_COUNT = Math.min(8, Math.max(1, (os.cpus()?.length || 4) - 1));
const WORKER_SCRIPT = path.join(__dirname, 'generate-xboot-buy-books-v2-worker.js');
const XBOOT_DIR = path.join(__dirname, 'games', 'xboot');

const BUY_SPECS = {
  buy3: {
    scatterCount: 3,
    seedIdPrefix: 'xbb3',
    spinCostMult: BUY_SCATTER3_COST_MULT,
    outDir: path.join(XBOOT_DIR, 'books-v2-buy3'),
    label: 'покупка 3 scatter (75×)'
  },
  buy4: {
    scatterCount: 4,
    seedIdPrefix: 'xbb4',
    spinCostMult: BUY_SCATTER4_COST_MULT,
    outDir: path.join(XBOOT_DIR, 'books-v2-buy4'),
    label: 'покупка 4 scatter (350×)'
  }
};

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

function runWorker(job, spec) {
  const shardPath = path.join(spec.outDir, `shard_${String(job.shardId).padStart(3, '0')}.bin`);
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SCRIPT, {
      workerData: {
        shardPath,
        shardId: job.shardId,
        startId: job.startId,
        count: job.count,
        scatterCount: spec.scatterCount,
        seedIdPrefix: spec.seedIdPrefix
      }
    });
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        console.log(
          `  shard ${msg.shardId}: ${msg.written}/${msg.count} (${(msg.elapsedMs / 1000).toFixed(0)}с)`
        );
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`worker shard ${job.shardId} exit ${code}`));
      else resolve({ ...job, shardPath });
    });
  });
}

async function generateShards(totalBooks, shardSize, spec) {
  const jobs = shardJobs(totalBooks, shardSize);
  const queue = [...jobs];
  const active = new Set();
  const results = [];

  async function pump() {
    while (active.size < WORKER_COUNT && queue.length) {
      const job = queue.shift();
      const p = runWorker(job, spec).then((r) => {
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

function computeBuyMetrics(shardPaths, spinCostMult) {
  let sumWin = 0;
  let count = 0;
  let maxWin = 0;
  let maxWinId = 0;
  let maxWinExcluded = 0;

  for (const { shardPath, startId, count: c } of shardPaths) {
    const fd = fs.openSync(shardPath, 'r');
    const chunk = Buffer.alloc(RECORD_SIZE * 4096);
    for (let base = 0; base < c; base += 4096) {
      const batch = Math.min(4096, c - base);
      const byteLen = batch * RECORD_SIZE;
      const off = SHARD_HEADER_SIZE + base * RECORD_SIZE;
      fs.readSync(fd, chunk, 0, byteLen, off);
      for (let i = 0; i < batch; i++) {
        const id = startId + base + i;
        const tw = chunk.readFloatLE(i * RECORD_SIZE + 12);
        const flags = chunk.readUInt8(i * RECORD_SIZE + 4);
        count++;
        sumWin += tw;
        if (tw > maxWin) {
          maxWin = tw;
          maxWinId = id;
        }
        if (flags & 4) maxWinExcluded++;
        if (tw >= 55200) maxWinExcluded++;
      }
    }
    fs.closeSync(fd);
  }

  const totalPaidBet = count * spinCostMult;
  return {
    count,
    sumWin,
    totalPaidBet,
    rtp: totalPaidBet > 0 ? (sumWin / totalPaidBet) * 100 : 0,
    avgWin: count > 0 ? sumWin / count : 0,
    maxWin,
    maxWinId,
    maxWinExcluded
  };
}

async function runBuyGeneration(buyKey) {
  const spec = BUY_SPECS[buyKey];
  if (!spec) throw new Error(`unknown buy key: ${buyKey}`);

  const shardSize = DEFAULT_SHARD_SIZE;
  const t0 = Date.now();

  console.log('='.repeat(60));
  console.log(`BOOKS_XBOOT_V2 BUY — ${spec.label}`);
  console.log(`Книг: ${TOTAL_BUY_BOOKS}, шард: ${shardSize}, воркеров: ${WORKER_COUNT}`);
  console.log(`Выход: ${spec.outDir}`);
  console.log(`Без максвина (< 55200×), RTP-цель: ${TARGET_RTP_PCT}% (cost ${spec.spinCostMult}×)`);
  console.log('='.repeat(60));

  if (!fs.existsSync(spec.outDir)) fs.mkdirSync(spec.outDir, { recursive: true });

  const shardResults = await generateShards(TOTAL_BUY_BOOKS, shardSize, spec);
  const shardPaths = shardResults.map((r) => ({
    shardPath: r.shardPath,
    startId: r.startId,
    count: r.count
  }));

  const metrics = computeBuyMetrics(shardPaths, spec.spinCostMult);
  console.log(`\nМетрики: RTP ${metrics.rtp.toFixed(4)}% | avg ${metrics.avgWin.toFixed(2)}×@1`);
  console.log(`max ${metrics.maxWin.toFixed(2)}× id ${metrics.maxWinId} | jackpot/maxwin rows ${metrics.maxWinExcluded}`);

  const meta = {
    format: 'BOOKS_XBOOT_V2_BUY',
    version: 2,
    buyType: buyKey,
    scatterCount: spec.scatterCount,
    totalBooks: TOTAL_BUY_BOOKS,
    shardSize,
    recordSize: RECORD_SIZE,
    spinCostMult: spec.spinCostMult,
    targetRtpPct: TARGET_RTP_PCT,
    measuredRtpPct: +metrics.rtp.toFixed(4),
    avgTotalWinAtBet1: +metrics.avgWin.toFixed(4),
    maxWinAtBet1: +metrics.maxWin.toFixed(4),
    maxWinBookId: metrics.maxWinId,
    noSyntheticMaxWin: true,
    seedIdPrefix: spec.seedIdPrefix,
    shards: shardPaths.map((s, i) => ({
      id: i,
      file: path.basename(s.shardPath),
      startId: s.startId,
      count: s.count
    }))
  };

  writeMeta(path.join(spec.outDir, 'meta.json'), meta);

  const dataBytes = TOTAL_BUY_BOOKS * RECORD_SIZE + shardPaths.length * SHARD_HEADER_SIZE;
  console.log('\n' + '='.repeat(60));
  console.log('Готово:', spec.outDir);
  console.log(`${shardPaths.length} шард(ов), ~${(dataBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Время: ${((Date.now() - t0) / 1000).toFixed(1)} с`);
  console.log('='.repeat(60));

  return metrics;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--buy-scatter4') || argv.includes('--buy4')) {
    await runBuyGeneration('buy4');
    return;
  }
  if (argv.includes('--buy-scatter3') || argv.includes('--buy3')) {
    await runBuyGeneration('buy3');
    return;
  }
  await runBuyGeneration('buy3');
  await runBuyGeneration('buy4');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  TOTAL_BUY_BOOKS,
  BUY_SCATTER3_COST_MULT,
  BUY_SCATTER4_COST_MULT,
  runBuyGeneration
};
