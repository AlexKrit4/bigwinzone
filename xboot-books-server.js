'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  RECORD_SIZE,
  SHARD_HEADER_SIZE,
  DEFAULT_SHARD_SIZE,
  decodeRecord,
  entryToClientFormat,
  readMeta,
  shardIdForBook,
  localIndexInShard
} = require('./xboot-books-v2.js');

const { parseBookLine, parseHeaderMeta } = require('./xboot-books-parse.js');

const PORT = Number(process.env.XBOOT_BOOKS_PORT) || 3848;
const HOST = process.env.XBOOT_BOOKS_HOST || '0.0.0.0';
const BOOKS_V2_DIR = path.join(__dirname, 'games', 'xboot', 'books-v2');
const XBOOT_DIR = path.join(__dirname, 'games', 'xboot');

const BUY_STORE_FILES = {
  buy3: 'books-seeds-buy-scatter3.txt',
  buy4: 'books-seeds-buy-scatter4.txt'
};

const BUY_V2_DIRS = {
  buy3: path.join(XBOOT_DIR, 'books-v2-buy3'),
  buy4: path.join(XBOOT_DIR, 'books-v2-buy4')
};

/** @type {{ meta: object, shards: Map<number, { path: string, fd: number, startId: number, count: number }>, jackpotId: number }} */
let v2Store = null;

/** @type {Record<string, object>} */
const buyStores = {};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(payload);
}

function bookIdFromSeed(seed) {
  const m = /^(?:xb|xbb3|xbb4)_([a-z0-9]+)_/i.exec(String(seed).trim());
  if (!m) return null;
  return parseInt(m[1], 36);
}

function loadShardStore(dir, label) {
  const metaPath = path.join(dir, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;

  const meta = readMeta(metaPath);
  const shards = new Map();

  for (const sh of meta.shards || []) {
    const shardPath = path.join(dir, sh.file);
    if (!fs.existsSync(shardPath)) {
      throw new Error(`missing buy shard ${sh.file}`);
    }
    const fd = fs.openSync(shardPath, 'r');
    shards.set(sh.id, {
      path: shardPath,
      fd,
      startId: sh.startId,
      count: sh.count
    });
  }

  return {
    type: 'v2',
    meta,
    shards,
    totalBooks: Number(meta.totalBooks) || 0
  };
}

function readBookFromStore(store, globalId) {
  if (!store?.shards) return null;
  const id = Number(globalId);
  if (!Number.isFinite(id) || id < 0 || id >= store.totalBooks) return null;

  const shardSize = store.meta.shardSize || DEFAULT_SHARD_SIZE;
  const shardId = shardIdForBook(id, shardSize);
  const shard = store.shards.get(shardId);
  if (!shard) return null;

  const local = localIndexInShard(id, shardSize);
  if (local >= shard.count) return null;

  const buf = Buffer.alloc(RECORD_SIZE);
  const off = SHARD_HEADER_SIZE + local * RECORD_SIZE;
  fs.readSync(shard.fd, buf, 0, RECORD_SIZE, off);
  return decodeRecord(buf, 0, id);
}

function loadV2Store() {
  const metaPath = path.join(BOOKS_V2_DIR, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`missing ${metaPath} — run: npm run xboot-books-v2`);
  }

  const meta = readMeta(metaPath);
  const shards = new Map();

  for (const sh of meta.shards || []) {
    const shardPath = path.join(BOOKS_V2_DIR, sh.file);
    if (!fs.existsSync(shardPath)) {
      throw new Error(`missing shard ${sh.file}`);
    }
    const fd = fs.openSync(shardPath, 'r');
    shards.set(sh.id, {
      path: shardPath,
      fd,
      startId: sh.startId,
      count: sh.count
    });
  }

  v2Store = {
    meta,
    shards,
    jackpotId: Number(meta.jackpotBookId) || 0,
    totalBooks: Number(meta.totalBooks) || 0
  };

  console.log(`  [v2] ${meta.totalBooks} книг, ${shards.size} шард(ов), RTP≈${meta.measuredRtpPct}%`);
}

async function loadBuyStore(key) {
  const v2Dir = BUY_V2_DIRS[key];
  const v2 = v2Dir ? loadShardStore(v2Dir, key) : null;
  if (v2?.totalBooks > 0) {
    buyStores[key] = { ...v2, count: v2.totalBooks };
    console.log(
      `  [${key}] V2: ${v2.totalBooks} книг, ${v2.shards.size} шард(ов), RTP≈${v2.meta.measuredRtpPct ?? '?'}%`
    );
    return;
  }

  const fileName = BUY_STORE_FILES[key];
  const filePath = path.join(XBOOT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`  [${key}] нет V2 (${v2Dir}) и TXT ${fileName}`);
    buyStores[key] = { type: 'txt', lines: [], seedMap: new Map(), meta: {}, count: 0 };
    return;
  }

  const text = await fs.promises.readFile(filePath, 'utf8');
  const meta = parseHeaderMeta(text);
  const lines = [];
  const seedMap = new Map();

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.includes('\t')) continue;
    const seed = trimmed.split('\t')[0]?.trim();
    if (!seed) continue;
    lines.push(trimmed);
    seedMap.set(seed, lines.length - 1);
  }

  buyStores[key] = { type: 'txt', lines, seedMap, meta, count: lines.length, fileName };
  console.log(`  [${key}] TXT ${fileName}: ${lines.length} книг`);
}

function readBookByGlobalId(globalId) {
  if (!v2Store) return null;
  const id = Number(globalId);
  if (!Number.isFinite(id) || id < 0 || id >= v2Store.totalBooks) return null;

  const shardId = shardIdForBook(id, v2Store.meta.shardSize || DEFAULT_SHARD_SIZE);
  const shard = v2Store.shards.get(shardId);
  if (!shard) return null;

  const local = localIndexInShard(id, v2Store.meta.shardSize || DEFAULT_SHARD_SIZE);
  if (local >= shard.count) return null;

  const buf = Buffer.alloc(RECORD_SIZE);
  const off = SHARD_HEADER_SIZE + local * RECORD_SIZE;
  fs.readSync(shard.fd, buf, 0, RECORD_SIZE, off);
  return decodeRecord(buf, 0, id);
}

function randomGlobalId(excludeJackpot = true) {
  const total = v2Store.totalBooks;
  if (total <= 0) return 0;
  if (excludeJackpot && total > 1) {
    let id;
    do {
      id = Math.floor(Math.random() * total);
    } while (id === v2Store.jackpotId);
    return id;
  }
  return Math.floor(Math.random() * total);
}

function randomBaseEntry(filterFn) {
  for (let attempt = 0; attempt < 48; attempt++) {
    const id = randomGlobalId(true);
    const entry = readBookByGlobalId(id);
    if (!entry) continue;
    if (!filterFn || filterFn(entry)) {
      return { index: id, entry: entryToClientFormat(entry) };
    }
  }
  const id = randomGlobalId(true);
  const entry = readBookByGlobalId(id);
  return entry ? { index: id, entry: entryToClientFormat(entry) } : null;
}

function buyStoreKey(scatter) {
  const n = Number(scatter);
  if (n === 3) return 'buy3';
  if (n === 4) return 'buy4';
  return null;
}

function randomBuyEntry(scatter) {
  const key = buyStoreKey(scatter);
  const store = key ? buyStores[key] : null;
  if (!store?.count) return null;

  if (store.type === 'v2') {
    const id = Math.floor(Math.random() * store.totalBooks);
    const raw = readBookFromStore(store, id);
    if (!raw) return null;
    return { store: key, index: id, entry: entryToClientFormat(raw) };
  }

  if (!store.lines?.length) return null;
  const line = store.lines[Math.floor(Math.random() * store.lines.length)];
  const entry = parseBookLine(line);
  return entry ? { store: key, entry } : null;
}

function entryBySeedBase(seed) {
  let id = bookIdFromSeed(seed);
  if (id == null || id < 0 || id >= v2Store.totalBooks) return null;
  const entry = readBookByGlobalId(id);
  if (!entry || entry.seed !== String(seed).trim()) return null;
  return { index: id, entry: entryToClientFormat(entry) };
}

function entryBySeedBuy(seed, scatter) {
  const key = buyStoreKey(scatter);
  const store = key ? buyStores[key] : null;
  if (!store) return null;

  if (store.type === 'v2') {
    const id = bookIdFromSeed(seed);
    if (id == null || id < 0 || id >= store.totalBooks) return null;
    const raw = readBookFromStore(store, id);
    if (!raw || raw.seed !== String(seed).trim()) return null;
    return { store: key, index: id, entry: entryToClientFormat(raw) };
  }

  const idx = store.seedMap?.get(String(seed).trim());
  if (idx === undefined) return null;
  const entry = parseBookLine(store.lines[idx]);
  return entry ? { store: key, entry } : null;
}

function healthPayload() {
  return {
    ok: !!v2Store,
    format: 'BOOKS_XBOOT_V2',
    port: PORT,
    v2: v2Store ? {
      ready: v2Store.totalBooks > 0,
      totalBooks: v2Store.totalBooks,
      shardCount: v2Store.shards.size,
      rtp: v2Store.meta.measuredRtpPct,
      hitRate: v2Store.meta.hitRatePct,
      bonusRate: v2Store.meta.bonusRatePct,
      jackpotBookId: v2Store.jackpotId,
      jackpotSeed: v2Store.meta.jackpotSeed || ''
    } : { ready: false },
    buy3: {
      ready: (buyStores.buy3?.count || 0) > 0,
      count: buyStores.buy3?.count || 0,
      format: buyStores.buy3?.type || 'none',
      rtp: buyStores.buy3?.meta?.measuredRtpPct ?? null
    },
    buy4: {
      ready: (buyStores.buy4?.count || 0) > 0,
      count: buyStores.buy4?.count || 0,
      format: buyStores.buy4?.type || 'none',
      rtp: buyStores.buy4?.meta?.measuredRtpPct ?? null
    }
  };
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, healthPayload());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/book/random') {
    const scatter = Number(url.searchParams.get('scatter') ?? '0');
    if (scatter === 3 || scatter === 4) {
      const hit = randomBuyEntry(scatter);
      if (!hit) {
        sendJson(res, 503, { error: 'buy store empty', scatter });
        return;
      }
      sendJson(res, 200, { store: hit.store, scatter, entry: hit.entry });
      return;
    }

    const filterScatter = scatter === 3 || scatter === 4 ? scatter : null;
    const hit = randomBaseEntry(
      filterScatter != null ? (e) => e.scatterCount === filterScatter : null
    );
    if (!hit) {
      sendJson(res, 503, { error: 'v2 store empty' });
      return;
    }
    sendJson(res, 200, { store: 'base', index: hit.index, entry: hit.entry });
    return;
  }

  const indexMatch = url.pathname.match(/^\/api\/book\/index\/(\d+)$/);
  if (req.method === 'GET' && indexMatch) {
    const scatter = Number(url.searchParams.get('scatter') ?? '0');
    const index = Number(indexMatch[1]);
    if (scatter === 3 || scatter === 4) {
      const key = buyStoreKey(scatter);
      const store = buyStores[key];
      if (store?.type === 'v2') {
        const raw = readBookFromStore(store, index);
        if (!raw) {
          sendJson(res, 404, { error: 'index not found', index, scatter });
          return;
        }
        sendJson(res, 200, { store: key, index, entry: entryToClientFormat(raw) });
        return;
      }
      if (!store?.lines?.[index]) {
        sendJson(res, 404, { error: 'index not found', index, scatter });
        return;
      }
      const entry = parseBookLine(store.lines[index]);
      sendJson(res, 200, { store: key, index, entry });
      return;
    }

    const entry = readBookByGlobalId(index);
    if (!entry) {
      sendJson(res, 404, { error: 'index not found', index });
      return;
    }
    sendJson(res, 200, { store: 'base', index, entry: entryToClientFormat(entry) });
    return;
  }

  const seedMatch = url.pathname.match(/^\/api\/book\/seed\/(.+)$/);
  if (req.method === 'GET' && seedMatch) {
    const scatter = Number(url.searchParams.get('scatter') ?? '0');
    const seed = decodeURIComponent(seedMatch[1]);
    if (scatter === 3 || scatter === 4) {
      const hit = entryBySeedBuy(seed, scatter);
      if (!hit) {
        sendJson(res, 404, { error: 'seed not found', seed, scatter });
        return;
      }
      sendJson(res, 200, { store: hit.store, scatter, entry: hit.entry });
      return;
    }

    const hit = entryBySeedBase(seed);
    if (!hit) {
      sendJson(res, 404, { error: 'seed not found', seed });
      return;
    }
    sendJson(res, 200, { store: 'base', index: hit.index, entry: hit.entry });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

async function main() {
  console.log('Индексация xBoot BOOKS_V2…');
  loadV2Store();
  await Promise.all(['buy3', 'buy4'].map(loadBuyStore));

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err);
      sendJson(res, 500, { error: String(err.message || err) });
    });
  });

  server.listen(PORT, HOST, () => {
    console.log('═'.repeat(60));
    console.log('XBOOT BOOKS SERVER (V2)');
    console.log(`  http://localhost:${PORT}/api/health`);
    console.log('  GET /api/book/random?scatter=0|3|4');
    console.log('  GET /api/book/index/{n}?scatter=…');
    console.log('  GET /api/book/seed/{seed}?scatter=…');
    console.log('═'.repeat(60));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
