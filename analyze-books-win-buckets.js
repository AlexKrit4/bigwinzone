'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const BUCKETS = [
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

const EXACT_ONE_EPS = 1e-6;

async function analyzeFile(filePath) {
    const counts = Object.fromEntries(BUCKETS.map((b) => [b.label, 0]));
    let total = 0;
    let bonusLines = 0;
    let exactOne = 0;
    let sumWin = 0;
    let maxWin = 0;

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const cols = t.split('\t');
        if (cols.length < 2) continue;
        const w = Number(cols[1]);
        if (!Number.isFinite(w)) continue;

        total++;
        sumWin += w;
        if (w > maxWin) maxWin = w;
        if (cols[2]?.trim() === '1') bonusLines++;

        if (w > 0 && Math.abs(w - 1) <= EXACT_ONE_EPS) exactOne++;

        let placed = false;
        for (const b of BUCKETS) {
            if (b.test(w)) {
                counts[b.label]++;
                placed = true;
                break;
            }
        }
        if (!placed) counts['?'] = (counts['?'] || 0) + 1;
    }

    return { total, counts, bonusLines, exactOne, sumWin, maxWin };
}

function pct(n, total) {
    return total ? ((100 * n) / total).toFixed(2) : '0.00';
}

function printReport(name, r) {
    console.log(`\n=== ${name} ===`);
    console.log(`Книг: ${r.total.toLocaleString('ru-RU')}`);
    console.log(`Средний total_win@1: ${(r.sumWin / r.total).toFixed(4)}×`);
    console.log(`Макс total_win@1: ${r.maxWin}×`);
    console.log(`Строк с бонусом (col bonus=1): ${r.bonusLines} (${pct(r.bonusLines, r.total)}%)`);
    console.log(`Ровно 1× (внутри (0;1.1]): ${r.exactOne} (${pct(r.exactOne, r.total)}%)`);
    console.log('\nКорзина total_win@1 | кол-во | %');
    for (const b of BUCKETS) {
        const n = r.counts[b.label] || 0;
        console.log(`${b.label.padEnd(14)} | ${String(n).padStart(7)} | ${pct(n, r.total).padStart(6)}%`);
    }
    if (r.counts['?']) console.log(`не попали в корзины: ${r.counts['?']}`);
}

async function main() {
    const root = __dirname;
    const files = [
        ['books-seeds.txt (базовая ставка)', path.join(root, 'books-seeds.txt')],
        ['books-seeds-mod-scatter1.txt (mod 1 scatter)', path.join(root, 'books-seeds-mod-scatter1.txt')],
    ];

    for (const [label, fp] of files) {
        if (!fs.existsSync(fp)) {
            console.error('Нет файла:', fp);
            continue;
        }
        const r = await analyzeFile(fp);
        printReport(label, r);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
