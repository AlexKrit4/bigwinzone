'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const ROOT = __dirname;

const BASE_BUCKETS = [
    { label: '0', test: (w) => w === 0 },
    { label: '(0; 1.1×]', test: (w) => w > 0 && w <= 1.1 },
    { label: '(1.1; 2×]', test: (w) => w > 1.1 && w <= 2 },
    { label: '(2; 5×]', test: (w) => w > 2 && w <= 5 },
    { label: '(5; 10×]', test: (w) => w > 5 && w <= 10 },
    { label: '(10; 20×]', test: (w) => w > 10 && w <= 20 },
    { label: '(20; 50×]', test: (w) => w > 20 && w <= 50 },
    { label: '(50; 100×]', test: (w) => w > 50 && w <= 100 },
    { label: '(100; 500×]', test: (w) => w > 100 && w <= 500 },
    { label: '> 500×', test: (w) => w > 500 },
];

function buyBuckets(cost) {
    return [
        { label: '0', test: (w) => w === 0 },
        { label: '(0; 1.1×]', test: (w) => w > 0 && w <= 1.1 },
        { label: '(1.1; 2×]', test: (w) => w > 1.1 && w <= 2 },
        { label: '(2; 5×]', test: (w) => w > 2 && w <= 5 },
        { label: '(5; 10×]', test: (w) => w > 5 && w <= 10 },
        { label: '(10; 20×]', test: (w) => w > 10 && w <= 20 },
        { label: '(20; 50×]', test: (w) => w > 20 && w <= 50 },
        { label: `(50; ${cost}×]`, test: (w) => w > 50 && w <= cost },
        { label: `(100; 500×]`, test: (w) => w > 100 && w <= 500 },
        { label: `[${cost}; 1k)`, test: (w) => w >= cost && w < 1000 },
        { label: '[1k; 5k)', test: (w) => w >= 1000 && w < 5000 },
        { label: '[5k; 41.5k)', test: (w) => w >= 5000 && w < 41500 },
        { label: 'джекпот 41500×', test: (w) => w >= 41500 },
    ];
}

async function analyzeFile(filePath, opts) {
    const buckets = opts.buy ? buyBuckets(opts.cost) : BASE_BUCKETS;
    const counts = Object.fromEntries(buckets.map((b) => [b.label, 0]));
    let total = 0;
    let bonus = 0;
    let sumRaw = 0;
    let sumPlayer = 0;
    let maxRaw = 0;
    let exactOne = 0;
    let headerRtp = null;
    let jackpotSeed = '';

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith('#')) {
            const rtpM = t.match(/^#\s*RTP_ALL_SEEDS:\s*([\d.]+)%/);
            if (rtpM) headerRtp = Number(rtpM[1]);
            const jpM = t.match(/^#\s*BUY_JACKPOT_SEED:\s*(\S+)/);
            if (jpM) jackpotSeed = jpM[1];
            continue;
        }
        const cols = t.split('\t');
        const w = Number(cols[1]);
        if (!Number.isFinite(w)) continue;

        total++;
        sumRaw += w;
        const playerPay = w >= 41500 ? 41500 : w;
        sumPlayer += playerPay;
        if (w > maxRaw) maxRaw = w;
        if (cols[2]?.trim() === '1') bonus++;
        if (w > 0 && Math.abs(w - 1) < 1e-6) exactOne++;

        let placed = false;
        for (const b of buckets) {
            if (b.test(w)) {
                counts[b.label]++;
                placed = true;
                break;
            }
        }
        if (!placed) counts['?'] = (counts['?'] || 0) + 1;
    }

    const pct = (n) => (total ? ((100 * n) / total).toFixed(2) : '0.00');
    const hitN = total - (counts['0'] || 0);
    const betMult = opts.cost || 1;
    const rtpCalc = ((sumPlayer / (total * betMult)) * 100).toFixed(4);

    return {
        total,
        bonus,
        hitN,
        hitPct: pct(hitN),
        exactOne,
        sumRaw,
        sumPlayer,
        avgRaw: (sumRaw / total).toFixed(4),
        maxRaw,
        headerRtp,
        rtpCalc,
        counts,
        pct,
        jackpotSeed,
        buckets,
    };
}

const FILES = [
    { name: 'База (books-seeds.txt)', file: 'books-seeds.txt', cost: 1 },
    { name: 'Mod1 scatter (books-seeds-mod-scatter1.txt)', file: 'books-seeds-mod-scatter1.txt', cost: 1.2 },
    { name: 'Buy3 (68×)', file: 'books-seeds-buy-scatter3.txt', cost: 68, buy: true },
    { name: 'Buy4 (140×)', file: 'books-seeds-buy-scatter4.txt', cost: 140, buy: true },
    { name: 'Buy5 (522×)', file: 'books-seeds-buy-scatter5.txt', cost: 522, buy: true },
];

async function main() {
    console.log('Проверка выборки сгенерированных книг\n');
    for (const f of FILES) {
        const fp = path.join(ROOT, f.file);
        if (!fs.existsSync(fp)) {
            console.log(`\n[SKIP] ${f.name}: нет файла`);
            continue;
        }
        const r = await analyzeFile(fp, f);
        console.log('='.repeat(64));
        console.log(f.name);
        console.log('='.repeat(64));
        console.log(`Книг: ${r.total.toLocaleString('ru-RU')} | hit (win>0): ${r.hitN} (${r.hitPct}%)`);
        console.log(`Бонус в строке: ${r.bonus} (${((100 * r.bonus) / r.total).toFixed(2)}%)`);
        console.log(`≈ ровно 1×: ${r.exactOne} (${r.pct(r.exactOne)}%)`);
        console.log(`Средний total_win@1: ${r.avgRaw}× | макс raw: ${r.maxRaw}×`);
        console.log(`RTP в шапке: ${r.headerRtp ?? '—'}% | пересчёт: ${r.rtpCalc}%`);
        if (r.jackpotSeed) console.log(`BUY_JACKPOT_SEED: ${r.jackpotSeed}`);
        console.log('\nКорзина total_win@1        кол-во      %');
        for (const b of r.buckets) {
            const n = r.counts[b.label] || 0;
            console.log(`${b.label.padEnd(22)} ${String(n).padStart(7)}  ${r.pct(n).padStart(6)}%`);
        }
        if (r.counts['?']) console.log(`не в корзинах: ${r.counts['?']}`);
        if (f.buy) {
            const low1015 = r.counts['(10; 20×]'] || 0;
            console.log(`\nОкупают ставку (≥${f.cost}×): см. корзины [${f.cost}; …) и джекпот`);
            console.log(`Доля только (10; 20×]: ${r.pct(low1015)}% (раньше было ~90%)`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
