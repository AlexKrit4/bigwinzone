'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseBookLine, parseHeaderMeta } = require('./books-parse.js');

const PORT = Number(process.env.BOOKS_SERVER_PORT) || 3847;
const HOST = process.env.BOOKS_SERVER_HOST || '0.0.0.0';
const ROOT = __dirname;

const STORE_FILES = {
    base: 'books-seeds.txt',
    mod1: 'books-seeds-mod-scatter1.txt',
    buy3: 'books-seeds-buy-scatter3.txt',
    buy4: 'books-seeds-buy-scatter4.txt',
    buy5: 'books-seeds-buy-scatter5.txt'
};

const SCATTER_TO_STORE = {
    0: 'base',
    1: 'mod1',
    3: 'buy3',
    4: 'buy4',
    5: 'buy5'
};

/** @type {Record<string, { lines: string[], seedMap: Map<string, number>, meta: object, count: number, fileName: string }>} */
const stores = {};

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

function readBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
    });
}

async function loadStore(key) {
    const fileName = STORE_FILES[key];
    const filePath = path.join(ROOT, fileName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`missing file: ${fileName}`);
    }

    const t0 = Date.now();
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

    stores[key] = {
        key,
        fileName,
        lines,
        seedMap,
        meta,
        count: lines.length,
        loadMs: Date.now() - t0
    };

    console.log(`  [${key}] ${fileName}: ${lines.length} книг за ${stores[key].loadMs} мс`);
    return stores[key];
}

async function loadAllStores() {
    console.log('Индексация книг на сервере…');
    const t0 = Date.now();
    await Promise.all(Object.keys(STORE_FILES).map((key) => loadStore(key)));
    console.log(`Готово за ${((Date.now() - t0) / 1000).toFixed(2)} с\n`);
}

function storeKeyFromScatter(scatter) {
    const n = Number(scatter);
    return SCATTER_TO_STORE[n] || 'base';
}

function randomEntry(storeKey) {
    const store = stores[storeKey];
    if (!store?.lines?.length) return null;
    const line = store.lines[Math.floor(Math.random() * store.lines.length)];
    return parseBookLine(line);
}

function entryBySeed(storeKey, seed) {
    const store = stores[storeKey];
    if (!store) return null;
    const idx = store.seedMap.get(String(seed).trim());
    if (idx === undefined) return null;
    return parseBookLine(store.lines[idx]);
}

function healthPayload() {
    const out = { ok: true, port: PORT, stores: {} };
    for (const [key, s] of Object.entries(stores)) {
        out.stores[key] = {
            ready: s.count > 0,
            fileName: s.fileName,
            count: s.count,
            rtp: s.meta?.rtp ?? null,
            jackpotSeed: s.meta?.jackpotSeed || ''
        };
    }
    return out;
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
        const scatter = url.searchParams.get('scatter') ?? '0';
        const storeKey = storeKeyFromScatter(scatter);
        const entry = randomEntry(storeKey);
        if (!entry) {
            sendJson(res, 503, { error: 'store empty', store: storeKey });
            return;
        }
        sendJson(res, 200, { store: storeKey, scatter: Number(scatter), entry });
        return;
    }

    const seedMatch = url.pathname.match(/^\/api\/book\/seed\/(.+)$/);
    if (req.method === 'GET' && seedMatch) {
        const scatter = url.searchParams.get('scatter') ?? '0';
        const storeKey = storeKeyFromScatter(scatter);
        const seed = decodeURIComponent(seedMatch[1]);
        const entry = entryBySeed(storeKey, seed);
        if (!entry) {
            sendJson(res, 404, { error: 'seed not found', seed, store: storeKey });
            return;
        }
        sendJson(res, 200, { store: storeKey, scatter: Number(scatter), entry });
        return;
    }

    sendJson(res, 404, { error: 'not found' });
}

async function main() {
    await loadAllStores();

    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
            console.error(err);
            sendJson(res, 500, { error: String(err.message || err) });
        });
    });

    server.listen(PORT, HOST, () => {
        console.log('═'.repeat(60));
        console.log('BOOKS SERVER');
        console.log(`  http://localhost:${PORT}/api/health`);
        console.log(`  GET /api/book/random?scatter=0|1|3|4|5`);
        console.log(`  GET /api/book/seed/{seed}?scatter=…`);
        console.log('═'.repeat(60));
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
