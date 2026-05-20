// Конфигурация слота
// xWays — специальный символ: после остановки барабанов превращается в оплачиваемый символ
// и даёт множитель "количества" (x2..x6) для ways-подсчёта на этом барабане.
const XWAYS_REDUCTION_FACTOR = 10; // шанс xWays уменьшен в 8 раз
const WILD_REDUCTION_FACTOR = 6;  // шанс wild = 1/4 от обычного символа
// Подобранный вес для scatter:
// при 15 клетках (5x3) вероятность получить 3+ scatter за спин ≈ 1/300.
// Это даёт p(scatter в клетке) ≈ 0.0206665.
const SCATTER_WEIGHT = 0.2489393146;

// wild — дикий символ: заменяет любой символ при подсчёте
const SYMBOLS = ['low1', 'low2', 'low3', 'low4', 'low5', 'high1', 'high2', 'high3', 'high4', 'high5', 'wild', 'scatter', 'xWays', 'split', 'split_wilds'];

const PAYOUTS = {
    'low1': { 3: 0.1, 4: 0.2, 5: 0.5 },
    'low2': { 3: 0.1, 4: 0.2, 5: 0.6 },
    'low3': { 3: 0.1, 4: 0.2, 5: 0.7 },
    'low4': { 3: 0.2, 4: 0.3, 5: 0.8 },
    'low5': { 3: 0.2, 4: 0.3, 5: 0.9 },
    'high1': { 3: 0.3, 4: 0.4, 5: 1 },
    'high2': { 3: 0.3, 4: 0.4, 5: 1.5 },
    'high3': { 3: 0.4, 4: 0.5, 5: 2.5 },
    'high4': { 3: 0.4, 4: 0.6, 5: 3 },
    'high5': { 3: 0.5, 4: 0.75, 5: 6 }
};

const NUM_REELS = 5;
const ROWS = 3;
const VISIBLE_ROWS = 3;
const SPIN_DURATION = 2000; // ms
const NUM_SPINS_PER_REEL = 1; // количество оборотов при спине (уменьшил для видимости)
const REEL_START_STAGGER_MS = 100; // Пауза между стартами анимации
const REEL_STOP_STAGGER_MS = 400; // Минимальный зазор между началом торможения соседних барабанов
const REEL_STOP_STAGGER_FAST_MS = 100; // Турбо: быстрее остановка барабанов один за другим

/** Турбо-режим: меньше пауза между остановками барабанов (кнопка ⚡). */
let fastReelStopMode = false;

/** Мобильный / touch: упрощённые эффекты и авто-масштаб. */
let isMobileSlot = false;
let isEmbeddedSlot = false;
let mobileLayoutRaf = 0;

function getReelStopStaggerMs() {
    return fastReelStopMode ? REEL_STOP_STAGGER_FAST_MS : REEL_STOP_STAGGER_MS;
}

function syncTurboReelsBtn() {
    const btn = document.getElementById('turboReelsBtn');
    if (!btn) return;
    btn.classList.toggle('active', fastReelStopMode);
    btn.setAttribute('aria-pressed', fastReelStopMode ? 'true' : 'false');
}

let turboReelsToggleBound = false;

function initTurboReelsToggle() {
    const btn = document.getElementById('turboReelsBtn');
    if (!btn) return;
    try {
        fastReelStopMode = localStorage.getItem('raveFastReelStop') === '1';
    } catch (_) {
        fastReelStopMode = false;
    }
    syncTurboReelsBtn();
    if (turboReelsToggleBound) return;
    turboReelsToggleBound = true;
    btn.addEventListener('click', () => {
        fastReelStopMode = !fastReelStopMode;
        try {
            localStorage.setItem('raveFastReelStop', fastReelStopMode ? '1' : '0');
        } catch (_) {}
        syncTurboReelsBtn();
    });
}
const ENHANCER_LEAD_MS = 400; // Насколько раньше окошко останавливается перед основным барабаном
// Общая линейная скорость прокрутки (px/ms): пока один барабан тормозит, остальные крутятся с той же скоростью
const REEL_SPIN_LINEAR_FRAC = 0.78; // доля «ленты», пройденная до фазы остановки
const REEL_SPIN_BASE_LINEAR_MS = 1150; // локальное время линейной фазы у 0-го барабана (без учёта порядка)
const REEL_DECEL_MS = 520; // длительность плавной доводки до финала

// Бонусная игра
let isBonusGame = false;
let bonusFreeSpin = 0;
let bonusSpinsTotal = 1;
let bonusTotalWin = 0;
let bonusModifier = null; // 'specchain', 'wild_dansa', 'mashup'
let bonusScatterCount = 0; // 3, 4 или 5
let bonusHighlightedReels = []; // для модификаторов
let bonusEnhancerMults = [2, 2, 2, 2, 2]; // персистентные множители в окошках
/** Если задан — фри-спины бонуса воспроизводятся из записей книги (детерминированно); иначе RNG. */
let bonusPlaybackSpinsRef = null;

/** Потолок выплаты за бонусный раунд (множитель к базовой ставке, как в книгах @1). */
const MAX_WIN_CAP_MULTIPLIER = 41500;
let maxWinBustedActive = false;
/** Текущий спин — джекпот-книга покупки бонуса (финал = BUSTED 41500×). */
let buyJackpotPending = false;

/** Нижние окошки (enhancer): 3 скаттера — барабаны 2–4; 4 — 2–5; 5 — все 5 */
function getBonusEnhancerReels() {
    if (bonusScatterCount >= 5) return [0, 1, 2, 3, 4];
    if (bonusScatterCount === 4) return [1, 2, 3, 4];
    return [1, 2, 3];
}

let balance = 1000.00; // начальный баланс игрока
let currentBaseBet = 1.00; // ставка
let isSpinning = false;
let reelStops = []; // конечные позиции для каждого барабана
let reelPositions = [0, 0, 0, 0, 0]; // текущие позиции барабанов
let casinoApiAvailable = true;

const CASINO_API = {
    async getBalance() {
        const response = await fetch('/api/balance', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = new Error(`Balance API failed: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return response.json();
    },

    async settleSpin(bet, win) {
        const response = await fetch('/api/spin', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bet, win })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.error || `Spin API failed: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return data;
    }
};

function notifyCasinoBalanceChanged() {
    window.parent?.postMessage({
        type: 'CASINO_BALANCE_UPDATED',
        balance
    }, window.location.origin);
}

async function loadCasinoBalance() {
    try {
        const data = await CASINO_API.getBalance();
        balance = Number(data.balance) || 0;
        updateBalance();
        notifyCasinoBalanceChanged();
    } catch (error) {
        if (error && error.status === 401) {
            balance = 0;
            updateBalance();
            alert('Войдите в аккаунт казино, чтобы играть на серверный баланс.');
            return;
        }

        // Старый статический сервер не имеет /api/*, поэтому оставляем локальный режим.
        casinoApiAvailable = false;
        console.warn('[CASINO] API недоступен, слот работает с локальным балансом.', error);
    }
}

async function settleCasinoSpin(bet, win) {
    if (!casinoApiAvailable) return;

    const data = await CASINO_API.settleSpin(bet, win);
    balance = Number(data.balance) || 0;
    updateBalance();
    notifyCasinoBalanceChanged();
}


// Быстрый доезд (skip)
const SKIP_APPEAR_DELAY_MS = 850;
const FAST_FORWARD_MS = 600;
let skipReady = false;
let skipAppearTimeout = null;
let activeReelControllers = [];
let activeEnhancerControllers = [];

// Аудио: фон и бонусные треки
let bgAudioEl = null;
let bonusAudios = {}; // map: scatterCount -> Audio
let currentBonusAudio = null;

function tryPlayAudio(audio) {
    if (!audio) return Promise.resolve(false);
    return audio.play().then(() => true).catch(() => false);
}

function initAudio() {
    bgAudioEl = document.getElementById('bgMusic');
    if (bgAudioEl) {
        bgAudioEl.loop = true;
        bgAudioEl.volume = 1;
    }

    // Инициализируем бонусные треки (loop)
    try {
        bonusAudios = {
            3: new Audio('images/bonus1.ogg'),
            4: new Audio('images/bonus2.ogg'),
            5: new Audio('images/bonus3.ogg')
        };

        for (const k of Object.keys(bonusAudios)) {
            const a = bonusAudios[k];
            a.loop = true;
            a.preload = 'auto';
            a.volume = 0.7;
        }
    } catch (e) {
        bonusAudios = {};
    }
}

function playBonusForCount(count) {
    const n = Math.min(5, Math.max(3, Math.floor(Number(count)) || 3));
    const a = bonusAudios[n] || null;
    if (!a) return;

    // Если уже играет нужный бонус — ничего не делаем
    if (currentBonusAudio === a && !currentBonusAudio.paused) return;

    // Остановим предыдущий бонус (если был)
    if (currentBonusAudio && currentBonusAudio !== a) {
        try { currentBonusAudio.pause(); } catch (e) {}
        try { currentBonusAudio.currentTime = 0; } catch (e) {}
    }

    // При остановке фона — паузим bg
    if (bgAudioEl && !bgAudioEl.paused) {
        try { bgAudioEl.pause(); } catch (e) {}
    }

    currentBonusAudio = a;
    void tryPlayAudio(currentBonusAudio);
}

function stopBonusAndResumeBg() {
    if (currentBonusAudio) {
        try { currentBonusAudio.pause(); } catch (e) {}
        try { currentBonusAudio.currentTime = 0; } catch (e) {}
        currentBonusAudio = null;
    }

    if (bgAudioEl) {
        void tryPlayAudio(bgAudioEl);
    }
}

function getMaxWinCapMoney(baseBet) {
    return (Number(baseBet) || 1) * MAX_WIN_CAP_MULTIPLIER;
}

function getCappedBonusPayout(baseBet) {
    return Math.min(bonusTotalWin, getMaxWinCapMoney(baseBet));
}

function animateMaxWinCounter(el, targetMoney, durationMs) {
    return new Promise((resolve) => {
        if (!el) {
            resolve();
            return;
        }
        const t0 = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - t0) / durationMs);
            const eased = t * t * (3 - 2 * t);
            el.textContent = (targetMoney * eased).toFixed(2);
            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = targetMoney.toFixed(2);
                resolve();
            }
        };
        requestAnimationFrame(tick);
    });
}

async function runMaxWinBustedFlow(baseBet) {
    maxWinBustedActive = true;
    const capMoney = getMaxWinCapMoney(baseBet);
    bonusTotalWin = capMoney;
    updateBonusHud();

    const bonusModal = document.getElementById('bonusModal');
    if (bonusModal) bonusModal.style.display = 'none';

    await sleep(1000);

    if (currentBonusAudio) {
        try { currentBonusAudio.pause(); } catch (e) {}
    }

    const maxwinEl = document.getElementById('maxwinMusic');
    if (maxwinEl) {
        maxwinEl.currentTime = 0;
        void tryPlayAudio(maxwinEl);
    }

    const overlay = document.getElementById('maxWinOverlay');
    const counterEl = document.getElementById('maxWinCounter');
    const bustedEl = document.getElementById('maxWinBusted');
    const contBtn = document.getElementById('maxWinContinueBtn');

    if (overlay) overlay.style.display = 'flex';
    if (bustedEl) bustedEl.style.display = 'none';
    if (contBtn) contBtn.style.display = 'none';
    if (counterEl) counterEl.textContent = '0.00';

    await animateMaxWinCounter(counterEl, capMoney, 8000);

    if (bustedEl) bustedEl.style.display = 'block';
    if (contBtn) contBtn.style.display = 'inline-block';

    await new Promise((resolve) => {
        if (!contBtn) {
            setTimeout(resolve, 2000);
            return;
        }
        const onContinue = () => {
            contBtn.removeEventListener('click', onContinue);
            resolve();
        };
        contBtn.addEventListener('click', onContinue);
    });

    if (overlay) overlay.style.display = 'none';
    if (maxwinEl) {
        try { maxwinEl.pause(); } catch (e) {}
        try { maxwinEl.currentTime = 0; } catch (e) {}
    }

    await finalizeBonusSession(capMoney);
    maxWinBustedActive = false;
}

function hideSkipButton() {
    const btn = document.getElementById('skipBtn');
    if (!btn) return;
    btn.classList.add('spin-hidden');
    btn.setAttribute('aria-disabled', 'true');
    skipReady = false;
}

function showSkipButton() {
    const btn = document.getElementById('skipBtn');
    if (!btn) return;
    btn.classList.remove('spin-hidden');
    btn.setAttribute('aria-disabled', 'false');
    skipReady = true;
}

function requestFastForward() {
    if (!isSpinning) return;
    if (!skipReady) return;

    hideSkipButton();

    const FAST_STAGGER_MS = 50; // Быстрый зазор (вместо 400)
    let fastDelay = 0;
    const now = performance.now();

    // Сортируем все активные барабаны и окошки по индексу
    const pending = [...activeReelControllers, ...activeEnhancerControllers].filter(c => c && c.started && !c.fast);
    pending.sort((a, b) => a.reelIndex - b.reelIndex);

    for (const c of pending) {
        // Если ещё не стартовали из-за delay — стартуем сразу
        if (!c.started) {
            if (c.startTimeoutId) {
                clearTimeout(c.startTimeoutId);
                c.startTimeoutId = null;
            }
            c.startAnimation();
        }

        const tNow = performance.now();
        const elapsed = tNow - c.startPerf;
        
        c.offAtFastStart = computeReelSpinOffsetPx(
            c.startOffset,
            c.scrollV,
            c.tDecelStart,
            c.decelMs,
            elapsed
        );
        c.fast = true;
        c.fastStart = now + fastDelay;
        
        fastDelay += FAST_STAGGER_MS;
    }
}

// Подсветка scatter во время замедления
let scatterGlowArmed = false;
let scatterGlowActive = false;
let scatterGlowSecondScatterReel = -1;

function clearReelSlowGlow() {
    for (let i = 0; i < NUM_REELS; i++) {
        const reel = document.getElementById(`reel${i}`);
        if (reel) reel.classList.remove('reel-slow-glow');
        const enhancer = document.getElementById(`enhancer${i}`);
        if (enhancer) enhancer.classList.remove('reel-slow-glow');
    }
}

function setReelSlowGlowForReelsStarting(fromReelIndex) {
    for (let i = fromReelIndex; i < NUM_REELS; i++) {
        const reel = document.getElementById(`reel${i}`);
        if (reel) reel.classList.add('reel-slow-glow');
        const enhancer = document.getElementById(`enhancer${i}`);
        if (enhancer && enhancer.classList.contains('active')) enhancer.classList.add('reel-slow-glow');
    }
}

function clearScatterGlow() {
    document.querySelectorAll('.symbol.scatter-glow').forEach((el) => el.classList.remove('scatter-glow'));
}

function getVisibleSymbolElement(reelIndex, row) {
    const reel = document.getElementById(`reel${reelIndex}`);
    const reelContent = reel?.querySelector('.reel-content');
    if (!reelContent) return null;
    const symbols = reelContent.querySelectorAll('.symbol');
    return symbols?.[row] || null;
}

function applyScatterGlowForReel(reelIndex) {
    for (let row = 0; row < VISIBLE_ROWS; row++) {
        if (currentBoard?.[reelIndex]?.[row] !== 'scatter') continue;
        const el = getVisibleSymbolElement(reelIndex, row);
        if (el) el.classList.add('scatter-glow');
    }
}

function countScattersOnCurrentBoard() {
    let c = 0;
    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (currentBoard?.[reel]?.[row] === 'scatter') c += 1;
        }
    }
    return c;
}

function pulseNewScatterIfMilestone(reelIndex, beforeCount, afterCount) {
    if (!(afterCount === 3 || afterCount === 4 || afterCount === 5)) return;
    if (afterCount !== beforeCount + 1) return;

    // На этом барабане максимум 1 scatter — найдём его и пульснём
    for (let row = 0; row < VISIBLE_ROWS; row++) {
        if (currentBoard?.[reelIndex]?.[row] !== 'scatter') continue;
        const el = getVisibleSymbolElement(reelIndex, row);
        if (!el) return;

        el.classList.remove('scatter-pop');
        // reflow, чтобы перезапустить анимацию при повторных заходах
        void el.offsetWidth;
        el.classList.add('scatter-pop');

        setTimeout(() => {
            el.classList.remove('scatter-pop');
        }, 500);
        return;
    }
}

function startScatterGlowUpToReel(maxReelIndex) {
    scatterGlowActive = true;
    clearScatterGlow();
    for (let r = 0; r <= maxReelIndex; r++) {
        applyScatterGlowForReel(r);
    }
}

// Модификаторы ставок
// pendingScatterGuarantee = 0 | 1 | 3 | 4 | 5 (применяется на следующий спин и затем сбрасывается)
let pendingScatterGuarantee = 0;
const MOD_SCATTER1_COST_MULT = 1.2;
const MOD_SCATTER3_COST_MULT = 68;
const MOD_SCATTER4_COST_MULT = 140;
const MOD_SCATTER5_COST_MULT = 522;
const MOD_SCATTER202_COST_MULT = 202;

function getSymbolHeight() {
    const reel = document.querySelector('.reel');
    if (!reel) return 100;
    const reelHeight = reel.getBoundingClientRect().height;
    const perRow = reelHeight / VISIBLE_ROWS;
    return Number.isFinite(perRow) && perRow > 0 ? perRow : 100;
}

function getRandomSymbolIndex(omitScatter = false) {
    // Взвешенный выбор:
    // обычные символы: 1
    // wild: 1 / WILD_REDUCTION_FACTOR
    // xWays: 1 / XWAYS_REDUCTION_FACTOR
    // scatter: SCATTER_WEIGHT (в бонусе scatter не выпадает — omitScatter)
    const weights = SYMBOLS.map((name) => {
        if (name === 'split' || name === 'split_wilds') return 0;
        if (omitScatter && name === 'scatter') return 0;
        if (name === 'xWays') return 1 / XWAYS_REDUCTION_FACTOR;
        if (name === 'wild') return 1 / WILD_REDUCTION_FACTOR;
        if (name === 'scatter') return SCATTER_WEIGHT;
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

function getRandomSymbolName() {
    return SYMBOLS[getRandomSymbolIndex(isBonusGame)];
}

// Хранит текущее состояние доски (5 барабанов по 3 символа)
let currentBoard = [
    ['low1', 'low2', 'low3'],
    ['low4', 'low5', 'high1'],
    ['high2', 'high3', 'high4'],
    ['high5', 'low1', 'low2'],
    ['low3', 'low4', 'low5']
];

// Множитель "количества" для ways на каждой позиции (по умолчанию 1).
let currentBoardMult = Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => 1));

/** Книги из books-seeds.txt (BOOKS_SEEDS_V2): индексы 0..14 = SYMBOLS слота (до split_wilds включительно) */
const BOOKS_MAX_SYM_INDEX_INCLUSIVE = SYMBOLS.indexOf('split_wilds');

let useRandomBookSpin = true;

/** Набор книг: базовые спины и mod scatter×1 (1.2× ставка). */
function createBooksStore(fileName, storeKey) {
    return {
        fileName,
        storeKey,
        list: [],
        /** @type {Map<string, object>} */
        map: new Map(),
        ready: false,
        bookCount: 0,
        queuedSeed: '',
        /** Сид единственной джекпот-книги (BUY_JACKPOT_SEED в шапке файла). */
        jackpotSeed: ''
    };
}

/** Книги на отдельном сервере — слот запрашивает сид при спине. */
let booksApiOnline = false;

function getBooksApiUrl(apiPath) {
    const base = (typeof window.RAVE_BOOKS_API === 'string' ? window.RAVE_BOOKS_API : '')
        .replace(/\/$/, '');
    const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    if (base) return `${base}${path}`;
    return `/books-api${path}`;
}

async function initBooksApiClient() {
    booksApiOnline = false;
    try {
        const res = await fetch(getBooksApiUrl('/api/health'), { cache: 'no-store' });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.ok) return false;

        for (const store of ALL_BOOK_STORES) {
            const meta = data.stores?.[store.storeKey];
            store.ready = Boolean(meta?.ready);
            store.bookCount = Number(meta?.count) || 0;
            store.jackpotSeed = meta?.jackpotSeed || '';
        }
        booksApiOnline = ALL_BOOK_STORES.some((s) => s.ready);
        return booksApiOnline;
    } catch (err) {
        console.warn('[BOOK API] недоступен:', err);
        return false;
    }
}

async function fetchRandomBookFromApi(scatterGuarantee) {
    const res = await fetch(
        getBooksApiUrl(`/api/book/random?scatter=${encodeURIComponent(scatterGuarantee)}`),
        { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`books random HTTP ${res.status}`);
    const data = await res.json();
    return data.entry || null;
}

async function fetchBookBySeedFromApi(seed, scatterGuarantee) {
    const res = await fetch(
        getBooksApiUrl(
            `/api/book/seed/${encodeURIComponent(seed)}?scatter=${encodeURIComponent(scatterGuarantee)}`
        ),
        { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.entry || null;
}

async function consumeQueuedForcedSeedBookFromApi(store, scatterGuarantee) {
    const raw = (store?.queuedSeed || '').trim();
    if (!raw) return null;
    store.queuedSeed = '';
    updateBooksLoadStatusHud();
    return fetchBookBySeedFromApi(raw, scatterGuarantee);
}

const booksStoreBase = createBooksStore('books-seeds.txt', 'base');
const booksStoreMod1 = createBooksStore('books-seeds-mod-scatter1.txt', 'mod1');
const booksStoreBuy3 = createBooksStore('books-seeds-buy-scatter3.txt', 'buy3');
const booksStoreBuy4 = createBooksStore('books-seeds-buy-scatter4.txt', 'buy4');
const booksStoreBuy5 = createBooksStore('books-seeds-buy-scatter5.txt', 'buy5');

const ALL_BOOK_STORES = [
    booksStoreBase,
    booksStoreMod1,
    booksStoreBuy3,
    booksStoreBuy4,
    booksStoreBuy5
];

/** @param {number} [scatterGuarantee] — для текущего спина; иначе pendingScatterGuarantee (HUD/очередь). */
function getActiveBooksStore(scatterGuarantee = pendingScatterGuarantee) {
    switch (scatterGuarantee) {
        case 1:
            return booksStoreMod1;
        case 3:
            return booksStoreBuy3;
        case 4:
            return booksStoreBuy4;
        case 5:
            return booksStoreBuy5;
        default:
            return booksStoreBase;
    }
}

const BOOK_SPIN_SCATTER_GUARANTEES = new Set([0, 1, 3, 4, 5]);

const BOOK_BONUS_FREE_SPINS_BY_SCATTER = { 3: 7, 4: 8, 5: 10 };

/** Только барабаны (5×3) из колонки landing / reels. */
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

/** Разбор колонок reels_enc / weights_enc в объект как у записи книги (индексы после resolve в генераторе). */
function spinFromEncodedParts(reelsEnc, weightsEnc, seedLabel = '') {
    const reelGroups = reelsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    const weightGroups = weightsEnc.split('|').map((g) => g.split(',').map((x) => Number(String(x).trim())));
    if (reelGroups.length !== NUM_REELS || weightGroups.length !== NUM_REELS) return null;
    for (let r = 0; r < NUM_REELS; r++) {
        if (reelGroups[r].length !== VISIBLE_ROWS || weightGroups[r].length !== VISIBLE_ROWS) return null;
    }
    const spin = {
        seed: seedLabel,
        weights: [],
        win: 0,
        winMultiplier: 0
    };
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

function parseBooksSeedsV2(text) {
    const scatterIx = SYMBOLS.indexOf('scatter');
    const entries = [];
    const map = new Map();
    for (const raw of text.split(/\r?\n/)) {
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const cols = trimmed.split('\t');
        if (cols.length < 5) continue;

        const seed = cols[0].trim();
        const totalWinAtBet1 = Number(cols[1]);
        const hasBonusMeta = cols[2].trim() === '1';

        const spin = spinFromEncodedParts(cols[3], cols[4], seed);
        if (!spin || !seed) continue;

        const { namesGrid, weightsGrid } = spinRecordToGrids(spin);
        const baseWinProbe = checkWin(1, namesGrid, weightsGrid);
        spin.win = baseWinProbe.totalWin;
        spin.winMultiplier = baseWinProbe.totalWin;

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

        const entry = {
            seed,
            lineIndex: entries.length,
            hasBonus: hasBonusMeta,
            totalWin: totalWinAtBet1,
            totalWinMultiplier: totalWinAtBet1,
            spin,
            bonusSpins
        };
        entries.push(entry);
        map.set(seed, entry);
    }
    return { entries, map };
}

async function fetchTextWithDownloadProgress(url, onDownloadRatio) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    const contentLength = Number(res.headers.get('Content-Length')) || 0;
    if (!res.body || !res.body.getReader) {
        const text = await res.text();
        onDownloadRatio?.(1);
        return text;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
            onDownloadRatio?.(Math.min(1, received / contentLength));
        } else {
            onDownloadRatio?.(0.5);
        }
    }

    onDownloadRatio?.(1);
    let text = '';
    for (const chunk of chunks) {
        text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    return text;
}

/**
 * @param {(ratio: number, status: string) => void} [onProgress] ratio 0..1, status — подпись этапа
 * @returns {Promise<boolean>}
 */
async function loadBooksFile(store, onProgress) {
    store.list = [];
    store.map = new Map();
    store.ready = false;

    const report = (ratio, status) => onProgress?.(Math.max(0, Math.min(1, ratio)), status);

    try {
        report(0, 'загрузка…');
        const text = await fetchTextWithDownloadProgress(store.fileName, (dl) => {
            report(dl * 0.72, 'загрузка…');
        });

        const jackpotMatch = text.match(/^#\s*BUY_JACKPOT_SEED:\s*(\S+)\s*$/m);
        store.jackpotSeed = jackpotMatch ? jackpotMatch[1].trim() : '';

        report(0.78, 'разбор…');
        await new Promise((resolve) => setTimeout(resolve, 0));

        const { entries, map } = parseBooksSeedsV2(text);
        for (const entry of entries) {
            entry.booksFile = store.fileName;
        }
        store.list = entries;
        store.map = map;
        store.ready = entries.length > 0;

        if (!store.ready) {
            console.warn(`[BOOK] ${store.fileName} пуст или неверный формат BOOKS_SEEDS_V2.`);
            report(1, 'ошибка: пустой файл');
            return false;
        }

        report(1, `готово (${entries.length.toLocaleString('ru-RU')} записей)`);
        return true;
    } catch (err) {
        console.warn(`[BOOK] не удалось загрузить ${store.fileName}:`, err);
        report(1, 'ошибка загрузки');
        return false;
    }
}

function warnMissingBookStores() {
    if (!booksStoreBase.ready) {
        console.warn('[BOOK] books-seeds.txt не загружен. node generate-books.js');
    }
    if (!booksStoreMod1.ready) {
        console.warn('[BOOK] books-seeds-mod-scatter1.txt не загружен. node generate-books.js --mod-scatter1');
    }
    if (!booksStoreBuy3.ready) {
        console.warn('[BOOK] books-seeds-buy-scatter3.txt не загружен. node generate-books.js --buy-scatter3');
    }
    if (!booksStoreBuy4.ready) {
        console.warn('[BOOK] books-seeds-buy-scatter4.txt не загружен. node generate-books.js --buy-scatter4');
    }
    if (!booksStoreBuy5.ready) {
        console.warn('[BOOK] books-seeds-buy-scatter5.txt не загружен. node generate-books.js --buy-scatter5');
    }
}

/**
 * @param {(overall: number, detail: string) => void} onProgress
 * @returns {Promise<boolean>} true если все 5 файлов загружены
 */
async function loadAllBooksSpinData(onProgress) {
    const fileProgress = ALL_BOOK_STORES.map(() => 0);
    let detailLine = '';

    const pushOverall = () => {
        const overall = fileProgress.reduce((sum, v) => sum + v, 0) / ALL_BOOK_STORES.length;
        onProgress?.(overall, detailLine);
    };

    const results = await Promise.all(
        ALL_BOOK_STORES.map(async (store, index) => {
            const ok = await loadBooksFile(store, (ratio, status) => {
                fileProgress[index] = ratio;
                detailLine = `${store.fileName} — ${status}`;
                pushOverall();
            });
            fileProgress[index] = 1;
            pushOverall();
            return ok;
        })
    );

    warnMissingBookStores();
    updateBooksLoadStatusHud();
    return results.every(Boolean);
}

function pickRandomBookSpin(store) {
    if (!store?.list?.length) return null;
    return store.list[Math.floor(Math.random() * store.list.length)];
}

function consumeQueuedForcedSeedBook(store) {
    if (!store) return null;
    const raw = (store.queuedSeed || '').trim();
    if (!raw) return null;
    store.queuedSeed = '';
    updateBooksLoadStatusHud();
    return store.map.get(raw) || null;
}

function spinPresetToFinalResultIndices(spin) {
    return [0, 1, 2, 3, 4].map((r) => [...(spin[`reel${r}`] || [])]);
}

/** Сетки имён/весов из записи книги (для checkWin базового спина). */
function spinRecordToGrids(spin) {
    const namesGrid = Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => ''));
    for (let r = 0; r < NUM_REELS; r++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            namesGrid[r][row] = SYMBOLS[spin[`reel${r}`][row]];
        }
    }
    return { namesGrid, weightsGrid: spin.weights };
}

/** Доска для анимации остановки: из landing в сиде (точно) или урезанная эвристика для старых строк. */
function spinPresetToLandingResultIndices(spin) {
    if (spin.landingReel0 != null) {
        return [0, 1, 2, 3, 4].map((r) => [...(spin[`landingReel${r}`] || spin[`reel${r}`] || [])]);
    }

    const fr = spinPresetToFinalResultIndices(spin);
    const sw = SYMBOLS.indexOf('split_wilds');
    const sp = SYMBOLS.indexOf('split');
    const xw = SYMBOLS.indexOf('xWays');
    const payable = new Set(Object.keys(PAYOUTS));

    for (let r = 0; r < NUM_REELS; r++) {
        const hadSplitBottom = fr[r][2] === sw;
        if (hadSplitBottom && sp >= 0) fr[r][2] = sp;

        if (xw < 0) continue;

        // Только верхние ряды (не окошко enhancer): старые сиды без landing
        for (let row = 0; row < 2; row++) {
            const symIdx = fr[r][row];
            const sym = SYMBOLS[symIdx];
            const w = Number(spin.weights[r][row]) || 1;

            if (symIdx === sw || sym === 'split' || !payable.has(sym) || w <= 1) continue;
            if (hadSplitBottom && w / 2 <= 1) continue;

            fr[r][row] = xw;
        }
    }
    return fr;
}

function gridsFromBoard() {
    const namesGrid = Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => ''));
    const weightsGrid = Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => 1));
    for (let r = 0; r < NUM_REELS; r++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            namesGrid[r][row] = currentBoard[r][row];
            weightsGrid[r][row] = currentBoardMult[r][row] || 1;
        }
    }
    return { namesGrid, weightsGrid };
}

/** Заполнить состояние из записи книги (после resolveXWays в генераторе). */
function applySpinPresetToState(spin) {
    for (let r = 0; r < NUM_REELS; r++) {
        const idxs = spin[`reel${r}`];
        const wrow = spin.weights[r];
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const ix = idxs[row];
            if (!(Number.isFinite(ix)) || ix < 0 || ix > BOOKS_MAX_SYM_INDEX_INCLUSIVE) {
                console.warn('[BOOK] Неверный индекс символа в книге', r, row, ix);
                return false;
            }
            currentBoard[r][row] = SYMBOLS[ix];
            currentBoardMult[r][row] = Number(wrow[row]) || 1;
        }
    }
    return true;
}

function scatterBonusExtraHtml(reelIndex) {
    if (!isBonusGame) return '';
    if (reelIndex === 4 && bonusScatterCount === 3) return '<span class="scatter-plus">+1</span>';
    if (reelIndex === 0 && bonusScatterCount === 4) return '<span class="scatter-plus">+2</span>';
    return '';
}

/** Обновить DOM первых трёх символов барабанов из currentBoard / currentBoardMult */
function refreshVisibleReelsDomFromBoard() {
    for (let reelIndex = 0; reelIndex < NUM_REELS; reelIndex++) {
        const reelEl = document.getElementById(`reel${reelIndex}`);
        const reelContent = reelEl?.querySelector('.reel-content');
        if (!reelContent) continue;

        /** нижний ряд в бонусе может дублироваться в окошке */
        if (isBonusGame && getBonusEnhancerReels().includes(reelIndex)) {
            const enhancer = document.getElementById(`enhancer${reelIndex}`);
            const ec = enhancer?.querySelector('.enhancer-content');
            const bot = currentBoard[reelIndex][2];
            const botMult = currentBoardMult[reelIndex][2] || 1;
            if (ec && enhancer?.classList.contains('active')) {
                const wraps = ec.querySelectorAll('.symbol');
                const w0 = wraps[0];
                if (w0) {
                    w0.innerHTML = buildScatterInnerForCell(bot, botMult, reelIndex, true);
                }
            }
        }

        const symbolEls = reelContent.querySelectorAll('.symbol');
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const cell = symbolEls[row];
            if (!cell) continue;
            const name = currentBoard[reelIndex][row];
            const mult = currentBoardMult[reelIndex][row] || 1;
            cell.innerHTML = buildScatterInnerForCell(name, mult, reelIndex, false);
        }
    }
}

/** innerHTML символа: img + опционально scatter-плашки + mult */
function buildScatterInnerForCell(symbolName, mult, reelIndex, isEnhancerMini) {
    const multPart = mult > 1 && symbolName !== 'split_wilds'
        ? `<span class="symbol-mult">x${mult}</span>`
        : '';
    /** В окошке enhancer не дублируем +1/+2 второй раз — только на основном барабане */
    const scatterExtras = (!isEnhancerMini && symbolName === 'scatter') ? scatterBonusExtraHtml(reelIndex) : '';
    return `<img src="images/${symbolName}.png" alt="${symbolName}">${scatterExtras}${multPart}`;
}

function updateLastSeedHud() {}

function updateBooksLoadStatusHud() {}

function setBooksBootProgress(overall) {
    const fill = document.getElementById('booksBootProgressFill');
    const ratio = Math.max(0, Math.min(1, Number(overall) || 0));
    const pctInt = Math.round(ratio * 100);
    if (fill) fill.style.width = `${pctInt}%`;
}

function isCoarsePointerDevice() {
    try {
        return window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches;
    } catch (_) {
        return window.innerWidth <= 900;
    }
}

function initMobileOptimizations() {
    isEmbeddedSlot = window.self !== window.top
        || /[?&]embed=1/.test(window.location.search);
    isMobileSlot = isCoarsePointerDevice() || isEmbeddedSlot;

    if (!isMobileSlot) return;

    document.documentElement.classList.add('mobile-slot');
    if (isEmbeddedSlot) document.documentElement.classList.add('embedded-slot');

    try {
        if (localStorage.getItem('raveFastReelStop') === null) {
            fastReelStopMode = true;
            localStorage.setItem('raveFastReelStop', '1');
        }
    } catch (_) {
        fastReelStopMode = true;
    }
    syncTurboReelsBtn();

    const applyLayout = () => {
        const root = document.documentElement;
        const board = document.querySelector('.board-stack');
        const container = document.querySelector('.container');
        if (!board || !container) return;

        container.style.setProperty('--slot-scale', '1');
        board.style.transform = '';
        board.style.width = '';
        board.style.marginBottom = '';

        const vv = window.visualViewport;
        const viewW = vv?.width ?? window.innerWidth;
        const viewH = vv?.height ?? window.innerHeight;
        const safeBottom = Number.parseFloat(
            getComputedStyle(root).getPropertyValue('env(safe-area-inset-bottom)') || '0',
        ) || 0;

        const hudReserve = isEmbeddedSlot ? 168 : 200;
        const availableH = Math.max(280, viewH - hudReserve - safeBottom - 24);
        const availableW = viewW - 16;

        const boardRect = board.getBoundingClientRect();
        const naturalW = board.offsetWidth || boardRect.width || 1;
        const naturalH = board.offsetHeight || boardRect.height || 1;
        const scale = Math.min(1, availableW / naturalW, availableH / naturalH, 1.15);
        const clamped = Math.max(0.42, Math.min(1, scale));

        root.style.setProperty('--slot-scale', String(clamped));
        if (clamped < 0.995) {
            board.style.transform = `scale(${clamped})`;
            board.style.transformOrigin = 'top center';
            board.style.width = `${naturalW}px`;
            board.style.marginLeft = 'auto';
            board.style.marginRight = 'auto';
            board.style.marginBottom = `${Math.round((1 - clamped) * naturalH * -0.35)}px`;
        }
    };

    const scheduleLayout = () => {
        if (mobileLayoutRaf) cancelAnimationFrame(mobileLayoutRaf);
        mobileLayoutRaf = requestAnimationFrame(() => {
            mobileLayoutRaf = 0;
            applyLayout();
        });
    };

    scheduleLayout();
    document.addEventListener('rave-mobile-layout', scheduleLayout);
    window.addEventListener('resize', scheduleLayout, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleLayout, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleLayout, { passive: true });

    const fsBtn = document.getElementById('mobileFsBtn');
    if (fsBtn && !fsBtn.dataset.bound) {
        fsBtn.dataset.bound = '1';
        fsBtn.addEventListener('click', () => {
            try {
                window.parent.postMessage({ type: 'RAVE_SLOT_REQUEST_FULLSCREEN' }, window.location.origin);
            } catch (_) {}
        });
    }
}

function initSlotAfterBooksReady() {
    initMobileOptimizations();
    preloadImages();
    initReels();
    setupEventListeners();
    updateBalance();
    loadCasinoBalance();
    initBackgroundMusic();
    initAudio();
    initCornerClock();
    if (isMobileSlot) {
        requestAnimationFrame(() => {
            document.dispatchEvent(new Event('rave-mobile-layout'));
        });
    }
}

async function bootBooksThenSlot() {
    const screen = document.getElementById('booksBootScreen');
    const continueBtn = document.getElementById('booksBootContinue');

    setBooksBootProgress(0.2);
    await initBooksApiClient();
    setBooksBootProgress(1);
    if (continueBtn) continueBtn.disabled = false;

    if (!continueBtn) {
        enterSlotFromBoot(screen);
        return;
    }

    continueBtn.addEventListener('click', () => {
        enterSlotFromBoot(screen);
    }, { once: true });
}

function enterSlotFromBoot(screen) {
    document.body.classList.remove('slot-boot-lock');
    if (screen) {
        screen.classList.add('books-boot-screen--done');
        setTimeout(() => screen.remove(), 450);
    }
    initSlotAfterBooksReady();
}

// Инициализация: сначала загрузка всех книг, затем слот по кнопке «Продолжить»
window.addEventListener('DOMContentLoaded', () => {
    void bootBooksThenSlot();
});

function initCornerClock() {
    const el = document.getElementById('cornerClock');
    if (!el) return;

    const pad2 = (n) => String(n).padStart(2, '0');

    const render = () => {
        const d = new Date();
        el.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    };

    render();
    setInterval(render, 1000);
}

function initBackgroundMusic() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.35;

    const tryPlay = async () => {
        try {
            await audio.play();
            return true;
        } catch {
            return false;
        }
    };

    // Пытаемся запустить сразу (может быть заблокировано браузером)
    void tryPlay().then((ok) => {
        if (ok) return;

        // Fallback: включаем на первом пользовательском действии
        const unlock = async () => {
            const played = await tryPlay();
            if (!played) return;
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: false, passive: true });
        window.addEventListener('keydown', unlock, { once: false });
    });
}

// Предзагрузка всех картинок символов
function preloadImages() {
    SYMBOLS.forEach(symbol => {
        const img = new Image();
        img.src = `images/${symbol}.png`;
    });
}

// Инициализация барабанов
function initReels() {
    for (let i = 0; i < NUM_REELS; i++) {
        const reel = document.getElementById(`reel${i}`);
        const reelContent = reel.querySelector('.reel-content');
        reelContent.innerHTML = '';

        // Отображаем начальную доску из currentBoard
        for (let j = 0; j < 3; j++) {
            const symbol = currentBoard[i][j];
            const mult = currentBoardMult[i][j] || 1;
            const symbolDiv = createSymbolElement(symbol, mult);
            reelContent.appendChild(symbolDiv);
        }
        
        // Начальная позиция
        reelPositions[i] = 0;
        reelContent.style.transform = 'translateY(0px)';
    }
}

// Создание элемента символа
function createSymbolElement(symbolName, mult = 1) {
    const div = document.createElement('div');
    div.className = 'symbol';
    const img = document.createElement('img');
    img.src = `images/${symbolName}.png`;
    img.alt = symbolName;
    img.loading = isMobileSlot ? 'lazy' : 'eager';
    img.decoding = isMobileSlot ? 'async' : 'sync';
    div.appendChild(img);

    if (mult > 1) {
        const badge = document.createElement('span');
        badge.className = 'symbol-mult';
        badge.textContent = `x${mult}`;
        div.appendChild(badge);
    }
    return div;
}

// Настройка слушателей событий
function setupEventListeners() {
    const spinBtn = document.getElementById('spinBtn');
    
    // Новые элементы ставки
    const betBtn = document.getElementById('betBtn');
    const betModal = document.getElementById('betModal');
    const betModalClose = document.getElementById('betModalClose');
    const betOptionsGrid = document.getElementById('betOptionsGrid');
    const currentBetValue = document.getElementById('currentBetValue');

    const paytableBtn = document.getElementById('paytableBtn');
    const paytableModal = document.getElementById('paytableModal');
    const paytableClose = document.getElementById('paytableClose');
    const modBtn = document.getElementById('modBtn');
    const modPanel = document.getElementById('modPanel');
    const skipBtn = document.getElementById('skipBtn');
    const modScatter1Btn = document.getElementById('modScatter1');
    const modScatter3Btn = document.getElementById('modScatter3');
    const modScatter4Btn = document.getElementById('modScatter4');
    const modScatter5Btn = document.getElementById('modScatter5');
    const modScatter202Btn = document.getElementById('modScatter202');

    spinBtn.addEventListener('click', spin);

    // Инициализация логики выбора ставки
    const betOptions = [0.1, 0.2, 0.5, 0.75, 1, 2, 3, 5, 10];
    
    betOptions.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'bet-option-btn';
        if (val === currentBaseBet) btn.classList.add('active');
        btn.textContent = val.toFixed(2);
        btn.onclick = () => {
            currentBaseBet = val;
            currentBetValue.textContent = val.toFixed(2);
            document.querySelectorAll('.bet-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            betModal.style.display = 'none';
            updateBetNote();
        };
        betOptionsGrid.appendChild(btn);
    });

    betBtn.addEventListener('click', () => {
        if (isSpinning) return;
        betModal.style.display = 'flex';
    });

    betModalClose.addEventListener('click', () => {
        betModal.style.display = 'none';
    });

    paytableBtn.addEventListener('click', () => {
        paytableModal.style.display = 'flex';
    });

    paytableClose.addEventListener('click', () => {
        paytableModal.style.display = 'none';
    });

    if (modBtn && modPanel) {
        modBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modPanel.style.display = (modPanel.style.display === 'none' || !modPanel.style.display) ? 'block' : 'none';
        });

        // Не даём пробелу "нажимать" кнопку mod. (но пробел всё равно крутит спин через общий обработчик)
        modBtn.addEventListener('keydown', (e) => {
            if (e.code === 'Space') e.preventDefault();
        });
        modBtn.addEventListener('keyup', (e) => {
            if (e.code === 'Space') e.preventDefault();
        });

        document.addEventListener('click', (e) => {
            if (modPanel.style.display !== 'block') return;
            const target = e.target;
            if (!(target instanceof Node)) return;
            if (modPanel.contains(target) || modBtn.contains(target)) return;
            modPanel.style.display = 'none';
        });
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            requestFastForward();
        });
    }

    initTurboReelsToggle();

    const setScatterMod = (count) => {
        pendingScatterGuarantee = (pendingScatterGuarantee === count) ? 0 : count;
        syncModUI();
        updateBetNote();
        updateBooksLoadStatusHud();
    };

    if (modScatter1Btn) modScatter1Btn.addEventListener('click', (e) => { e.stopPropagation(); setScatterMod(1); });
    if (modScatter3Btn) modScatter3Btn.addEventListener('click', (e) => { e.stopPropagation(); setScatterMod(3); });
    if (modScatter4Btn) modScatter4Btn.addEventListener('click', (e) => { e.stopPropagation(); setScatterMod(4); });
    if (modScatter5Btn) modScatter5Btn.addEventListener('click', (e) => { e.stopPropagation(); setScatterMod(5); });
    if (modScatter202Btn) modScatter202Btn.addEventListener('click', (e) => { e.stopPropagation(); setScatterMod(202); });

    // Спин по пробелу
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space') return;

        // Не мешаем вводу в инпутах
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

        // Не крутим, если открыта модалка
        if (paytableModal && paytableModal.style.display === 'flex') return;

        const dbgModal = document.getElementById('debugModal');
        if (dbgModal && dbgModal.classList.contains('active')) return;

        // Во время спина пробел управляет кнопкой "skip" (если она уже доступна)
        if (isSpinning) {
            const sBtn = document.getElementById('skipBtn');
            if (sBtn && !sBtn.classList.contains('spin-hidden') && sBtn.getAttribute('aria-disabled') !== 'true') {
                e.preventDefault();
                requestFastForward();
            }
            return;
        }

        const btn = document.getElementById('spinBtn');
        if (!btn) return;
        if (btn.classList.contains('spin-hidden')) return;

        e.preventDefault();
        spin();
    });

    syncModUI();
    updateBetNote();

    // ===== ОТЛАДКА: Открытие модала =====
    const debugBtn = document.getElementById('debugBtn');
    const debugModal = document.getElementById('debugModal');
    const debugModalClose = document.getElementById('debugModalClose');
    const playBigWinBtn = document.getElementById('playBigWinBtn');
    const debugBigWinInput = document.getElementById('debugBigWinInput');

    if (debugBtn && debugModal) {
        debugBtn.addEventListener('click', () => {
            debugModal.classList.add('active');
            if (debugBigWinInput) debugBigWinInput.focus();
            const uc = document.getElementById('useBooksRandomSpin');
            if (uc) uc.checked = useRandomBookSpin;
        });
    }

    if (debugModalClose) {
        debugModalClose.addEventListener('click', () => {
            debugModal.classList.remove('active');
        });
    }

    if (playBigWinBtn && debugBigWinInput) {
        playBigWinBtn.addEventListener('click', () => {
            const xVal = parseFloat(debugBigWinInput.value);
            if (isNaN(xVal) || xVal <= 0) {
                alert('Введите корректный множитель x (больше 0)');
                return;
            }
            debugModal.classList.remove('active');
            
            // Запуск Big Win с расчетом суммы
            const targetWin = xVal * (currentBaseBet || 1);
            showWinPresentation({
                totalWin: targetWin,
                winLines: 243,
                highlights: [],
                totalWays: 243
            });
        });
    }

    const chkUseBooks = document.getElementById('useBooksRandomSpin');
    const queueSeedBtn = document.getElementById('queueForcedSeedBtn');
    const seedForcedInput = document.getElementById('debugForcedSeedInput');

    if (chkUseBooks) {
        chkUseBooks.checked = useRandomBookSpin;
        chkUseBooks.addEventListener('change', () => {
            useRandomBookSpin = chkUseBooks.checked;
            updateBooksLoadStatusHud();
        });
    }

    if (queueSeedBtn && seedForcedInput && debugModal) {
        queueSeedBtn.addEventListener('click', () => {
            const raw = seedForcedInput.value.trim();
            if (!raw) {
                alert('Введите seed (первая колонка строки books-seeds.txt).');
                return;
            }
            const store = getActiveBooksStore();
            if (!store.ready) {
                const genHint = {
                    1: ' --mod-scatter1',
                    3: ' --buy-scatter3',
                    4: ' --buy-scatter4',
                    5: ' --buy-scatter5'
                }[pendingScatterGuarantee] || '';
                alert(`Файл ${store.fileName} не загрузился. Положите его рядом с index.html и выполните node generate-books.js${genHint}.`);
                return;
            }
            if (!store.map.has(raw)) {
                alert(`Такого seed нет в ${store.fileName}. Проверьте строку целиком.`);
                return;
            }
            store.queuedSeed = raw;
            updateBooksLoadStatusHud();
            seedForcedInput.value = '';
            debugModal.classList.remove('active');
        });
    }

}

function syncModUI() {
    const buttons = [
        { id: 'modScatter1', count: 1 },
        { id: 'modScatter3', count: 3 },
        { id: 'modScatter4', count: 4 },
        { id: 'modScatter5', count: 5 },
        { id: 'modScatter202', count: 202 }
    ];

    for (const b of buttons) {
        const el = document.getElementById(b.id);
        if (!el) continue;
        const active = pendingScatterGuarantee === b.count;
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
}

function getBetCost(baseBet) {
    const b = Number(baseBet) || 0;
        return b * getBetCostMultiplier();
}

    function getBetCostMultiplier() {
        switch (pendingScatterGuarantee) {
            case 1:
                return MOD_SCATTER1_COST_MULT;
            case 3:
                return MOD_SCATTER3_COST_MULT;
            case 4:
                return MOD_SCATTER4_COST_MULT;
            case 5:
                return MOD_SCATTER5_COST_MULT;
            case 202:
                return MOD_SCATTER202_COST_MULT;
            default:
                return 1;
        }
    }

function updateBetNote() {
    const betNote = document.getElementById('betNote');
    if (!betNote) return;

    const baseBet = currentBaseBet;
    if (pendingScatterGuarantee <= 0) {
        betNote.style.display = 'none';
        betNote.textContent = '';
        return;
    }

    const finalBet = baseBet * getBetCostMultiplier();
    betNote.style.display = 'block';
    betNote.textContent = `основная ставка - ${finalBet.toFixed(2)}`;
}

// Главная функция спина
async function spin() {
    const spinBtn = document.getElementById('spinBtn');
    const modBtn = document.getElementById('modBtn');
    const modPanel = document.getElementById('modPanel');
    const skipBtn = document.getElementById('skipBtn');
    const baseBet = currentBaseBet;
    const scatterGuarantee = pendingScatterGuarantee;
    const multForThisSpin = scatterGuarantee > 0
        ? (scatterGuarantee === 1 ? MOD_SCATTER1_COST_MULT
            : scatterGuarantee === 3 ? MOD_SCATTER3_COST_MULT
                : scatterGuarantee === 4 ? MOD_SCATTER4_COST_MULT
                    : scatterGuarantee === 5 ? MOD_SCATTER5_COST_MULT
                        : scatterGuarantee === 202 ? MOD_SCATTER202_COST_MULT
                        : 1)
        : 1;
    const finalBet = baseBet * multForThisSpin;

    // Проверки
    if (isSpinning) return;
    if (finalBet > balance) {
        alert('Недостаточно средств!');
        return;
    }
    if (baseBet <= 0) {
        alert('Ставка должна быть больше 0!');
        return;
    }

    // Списываем ставку с баланса
    if (casinoApiAvailable) {
        try {
            await settleCasinoSpin(finalBet, 0);
        } catch (error) {
            console.error('[CASINO] Ошибка списания ставки:', error);
            alert(error.message || 'Ошибка списания ставки. Попробуйте еще раз.');
            return; // Прекращаем выполнение, спин не начнется
        }
    } else {
        balance -= finalBet;
        updateBalance();
    }

    // Моды 3/4/5 — одноразовые. Мод "1 скаттер" не выключаем сам по себе.
    if (pendingScatterGuarantee !== 1) {
        pendingScatterGuarantee = 0;
    }
    syncModUI();
    updateBetNote();

    isSpinning = true;
    if (spinBtn) {
        spinBtn.classList.add('spin-hidden');
        spinBtn.setAttribute('aria-disabled', 'true');
    }

    // mod. исчезает вместе со spin и панель закрывается
    if (modPanel) modPanel.style.display = 'none';
    if (modBtn) {
        modBtn.classList.add('spin-hidden');
        modBtn.setAttribute('aria-disabled', 'true');
    }

    // skip появляется через 0.5с после исчезновения спина
    hideSkipButton();
    if (skipAppearTimeout) {
        clearTimeout(skipAppearTimeout);
        skipAppearTimeout = null;
    }
    skipAppearTimeout = setTimeout(() => {
        skipAppearTimeout = null;
        if (!isSpinning) return;
        showSkipButton();
    }, SKIP_APPEAR_DELAY_MS);

    // На старте спина счётчик линий всегда базовый
    setLinesCounter(243);

    // Сразу убираем прошлый выигрыш из HUD/оверлея при нажатии на спин
    clearWinPresentation();
    hideWinHud();
    
    // Сбрасываем данные о выигрыше из книги для этого спина
    window.currentSpinData = null;

    let finalResult;
    /** Базовый спин из books-seeds.txt (BOOKS_SEEDS_V2); фри из файла только если у записи есть полный хвост бонуса */
    let playBaseSpinFromBooks = false;
    let presetBookWhole = null;

    const booksStore = getActiveBooksStore(scatterGuarantee);
    const canPickBookForSpin =
        booksApiOnline
        && booksStore.ready
        && !isBonusGame
        && BOOK_SPIN_SCATTER_GUARANTEES.has(scatterGuarantee);

    if (canPickBookForSpin) {
        try {
            presetBookWhole = await consumeQueuedForcedSeedBookFromApi(booksStore, scatterGuarantee);
            if (!presetBookWhole && useRandomBookSpin) {
                presetBookWhole = await fetchRandomBookFromApi(scatterGuarantee);
            }
        } catch (err) {
            console.error('[BOOK API] ошибка запроса сида:', err);
            presetBookWhole = null;
        }
    }

    if (presetBookWhole?.spin?.reel0) {
        playBaseSpinFromBooks = true;
        finalResult = spinPresetToLandingResultIndices(presetBookWhole.spin);
        buyJackpotPending = Boolean(
            booksStore.jackpotSeed
            && presetBookWhole.spin.seed === booksStore.jackpotSeed
        );
    } else {
        buyJackpotPending = false;
        finalResult = generateResult(scatterGuarantee);
    }

    // Книга: без финальных весов на ленте — x2 над split и множитель xWays только после resolve
    await spinReels(finalResult, null);

    if (skipAppearTimeout) {
        clearTimeout(skipAppearTimeout);
        skipAppearTimeout = null;
    }
    hideSkipButton();

    // Замедление закончилось вместе с остановкой 5-го барабана
    scatterGlowArmed = false;
    scatterGlowActive = false;
    scatterGlowSecondScatterReel = -1;
    clearScatterGlow();
    clearReelSlowGlow();

    console.log('Финальный результат:', finalResult.map((reel, i) => 
        `Барабан ${i}: [${reel.map(idx => SYMBOLS[idx]).join(', ')}]`
    ));

    let afterTwoScatter;

    if (playBaseSpinFromBooks && presetBookWhole?.spin) {
        const hadSplitsBook = await resolveSplitsAndUpdateBoardAnimated();
        if (hadSplitsBook) {
            await sleep(500);
        }

        const resolvedBook = await resolveXWaysAndUpdateBoardAnimated(presetBookWhole.spin);
        if (resolvedBook.hadXWays) {
            await sleep(500);
        }

        applySpinPresetToState(presetBookWhole.spin);
        refreshVisibleReelsDomFromBoard();
        updateLastSeedHud(presetBookWhole.spin, presetBookWhole);

        afterTwoScatter = {
            ...(gridsFromBoard()),
            xWaysReplacementSymbol: resolvedBook.xWaysReplacementSymbol ?? null
        };

        const expectedMoney = Number(presetBookWhole.spin.win) * Number(baseBet) || 0;
        const probe = checkWin(baseBet, afterTwoScatter.namesGrid, afterTwoScatter.weightsGrid);
        if (Math.abs(probe.totalWin - expectedMoney) > 0.015) {
            console.warn('[BOOK] Расхождение выигрыша JSON vs слот',
                'JSON win×ставка=', expectedMoney,
                'checkWin=', probe.totalWin,
                'seed=', presetBookWhole.spin.seed);
        }
    } else if (!playBaseSpinFromBooks) {
        const hadSplits = await resolveSplitsAndUpdateBoardAnimated();
        if (hadSplits) {
            await sleep(500);
        }

        const resolved = await resolveXWaysAndUpdateBoardAnimated();

        if (resolved.hadXWays) {
            await sleep(500);
        }

        afterTwoScatter = await maybeResolveExactlyTwoScatters(
            resolved.namesGrid,
            resolved.weightsGrid,
            resolved.xWaysReplacementSymbol,
            { protectReel1CenterScatter: scatterGuarantee === 1 }
        );
    }

    setLinesCounter(calculateTotalLinesFromWeights(afterTwoScatter.weightsGrid));

    // Выигрыш считаем по БАЗОВОЙ ставке (без модификатора)
    let winAmount = 0;
    let winInfo = checkWin(baseBet, afterTwoScatter.namesGrid, afterTwoScatter.weightsGrid);
    winAmount = winInfo.totalWin;
    
    if (casinoApiAvailable) {
        if (winAmount > 0) {
            try {
                await settleCasinoSpin(0, winAmount);
            } catch (error) {
                console.error('[CASINO] Ошибка зачисления выигрыша:', error);
            }
        }
    } else {
        balance += winAmount;
        updateBalance();
    }
    displayWin(winAmount);

    let waitWinCountEnd = Promise.resolve();
    if (winAmount > 0) {
        waitWinCountEnd = showWinPresentation(winInfo);
    }

    // Кнопку Spin возвращаем, когда счётчик на доске досчитал до конца
    await waitWinCountEnd;

    const scatterCount = countSymbol(afterTwoScatter.namesGrid, 'scatter');
    bonusPlaybackSpinsRef = null;
    if (
        scatterCount >= 3 &&
        playBaseSpinFromBooks &&
        presetBookWhole &&
        Array.isArray(presetBookWhole.bonusSpins)
    ) {
        const expectedLen = BOOK_BONUS_FREE_SPINS_BY_SCATTER[scatterCount];
        if (expectedLen && presetBookWhole.bonusSpins.length === expectedLen) {
            bonusPlaybackSpinsRef = presetBookWhole.bonusSpins;
        }
    }
    if (scatterCount >= 3) {
        initBonus(scatterCount);
        return;
    }

    isSpinning = false;
    if (spinBtn) {
        spinBtn.classList.remove('spin-hidden');
        spinBtn.setAttribute('aria-disabled', 'false');
    }

    if (modBtn) {
        modBtn.classList.remove('spin-hidden');
        modBtn.setAttribute('aria-disabled', 'false');
    }

    if (skipBtn) {
        skipBtn.classList.add('spin-hidden');
        skipBtn.setAttribute('aria-disabled', 'true');
    }

    updateBetNote();
}

function countSymbol(namesGrid, symbolName) {
    let c = 0;
    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (namesGrid?.[reel]?.[row] === symbolName) c += 1;
        }
    }
    return c;
}

async function maybeResolveExactlyTwoScatters(
    namesGrid,
    weightsGrid,
    existingXWaysReplacementSymbol = null,
    options = {}
) {
    const scatterCount = countSymbol(namesGrid, 'scatter');
    if (scatterCount !== 2) {
        return { namesGrid, weightsGrid, xWaysReplacementSymbol: existingXWaysReplacementSymbol };
    }

    const protectReel1Center = options.protectReel1CenterScatter === true;
    const isProtected = (reel, row) => protectReel1Center && reel === 1 && row === 1;

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

    // Выбираем финальные результаты только для незащищённых скаттеров
    const outcomes = mutablePositions.map(() => miniSymbols[Math.floor(Math.random() * miniSymbols.length)]);

    // Если выпал xWays — используем существующий replacement символ, либо выбираем один раз
    let xWaysReplacementSymbol = existingXWaysReplacementSymbol;
    if (!xWaysReplacementSymbol && outcomes.includes('xWays')) {
        xWaysReplacementSymbol = payableSymbols[Math.floor(Math.random() * payableSymbols.length)];
    }

    // Анимация: прокрутка только внутри этих двух ячеек (как у барабана, но со своим временем)
    const duration = 1850;

    function createSpinItemHtml(symbolName, heightPx) {
        const showName = symbolName === 'xWays' ? 'xWays' : symbolName;
        const safeH = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 100;
        return (
            `<div style="height:${safeH}px; display:flex; align-items:center; justify-content:center;">
                <img src="images/${showName}.png" alt="${showName}" style="width:100%; height:100%; object-fit:contain;" />
            </div>`
        );
    }

    function animateCellSpin(cellEl, finalShowName, cellDurationMs) {
        return new Promise((resolve) => {
            if (!cellEl) {
                resolve();
                return;
            }

            cellEl.classList.add('scatter-mini-spin');

            const rect = cellEl.getBoundingClientRect();
            const cellHeight = (Number.isFinite(rect.height) && rect.height > 0) ? rect.height : getSymbolHeight();

            // Сохраняем текущее содержимое, чтобы корректно восстановить структуру в конце
            const oldHtml = cellEl.innerHTML;

            // Убираем старый бейдж (если есть)
            const oldBadge = cellEl.querySelector('.symbol-mult');
            if (oldBadge) oldBadge.remove();

            const baseSpinSymbols = SYMBOLS.length * NUM_SPINS_PER_REEL;
            const totalSpinSymbols = Math.max(1, Math.ceil(baseSpinSymbols * (cellDurationMs / SPIN_DURATION)));

            // Лента: ФИНАЛ (виден в конце) -> РАНДОМ -> СТАРТ (scatter виден в начале)
            const randomParts = [];
            for (let i = 0; i < totalSpinSymbols; i++) {
                const pick = miniSymbols[Math.floor(Math.random() * miniSymbols.length)];
                randomParts.push(createSpinItemHtml(pick, cellHeight));
            }

            const viewport = document.createElement('div');
            viewport.style.position = 'relative';
            viewport.style.width = '100%';
            viewport.style.height = '100%';
            viewport.style.overflow = 'hidden';

            const strip = document.createElement('div');
            strip.style.position = 'absolute';
            strip.style.left = '0';
            strip.style.top = '0';
            strip.style.width = '100%';
            if (!isMobileSlot) strip.style.willChange = 'transform';

            strip.innerHTML = [
                createSpinItemHtml(finalShowName, cellHeight),
                ...randomParts,
                createSpinItemHtml('scatter', cellHeight)
            ].join('');

            // Чтобы не мигнул финал на 1 кадр: сначала скрываем, ставим стартовую позицию
            viewport.style.visibility = 'hidden';
            viewport.appendChild(strip);
            cellEl.innerHTML = '';
            cellEl.appendChild(viewport);

            const startOffset = (1 + totalSpinSymbols) * cellHeight;
            strip.style.transform = `translateY(-${startOffset}px)`;
            strip.getBoundingClientRect();

            requestAnimationFrame(() => {
                viewport.style.visibility = 'visible';
                
                // Используем физику
                const scrollV = (REEL_SPIN_LINEAR_FRAC * startOffset) / REEL_SPIN_BASE_LINEAR_MS;
                const decelDistance = Math.max(0, startOffset - scrollV * REEL_SPIN_BASE_LINEAR_MS);
                let localTDecel = Math.max(0, (startOffset - decelDistance) / scrollV);
                const decelMs = REEL_DECEL_MS;
                const tDecelEnd = localTDecel + decelMs;
                
                const startPerf = performance.now();

                const tick = () => {
                    const now = performance.now();
                    const elapsed = now - startPerf;
                    
                    let currentOffset;
                    let finished;

                    if (elapsed >= tDecelEnd) {
                        currentOffset = 0;
                        finished = true;
                    } else {
                        currentOffset = computeReelSpinOffsetPx(
                            startOffset,
                            scrollV,
                            localTDecel,
                            decelMs,
                            elapsed
                        );
                        finished = false;
                    }

                    strip.style.transform = `translateY(-${currentOffset}px)`;

                    if (finished) {
                        // Восстанавливаем “нормальный” вид ячейки
                        cellEl.innerHTML = `<img src="images/${finalShowName}.png" alt="${finalShowName}">`;
                        cellEl.classList.remove('scatter-mini-spin');
                        resolve({ oldHtml });
                        return;
                    }
                    requestAnimationFrame(tick);
                };

                requestAnimationFrame(tick);
            });
        });
    }

    const tasks = mutablePositions.map((pos, idx) => {
        const reelEl = document.getElementById(`reel${pos.reel}`);
        const reelContent = reelEl?.querySelector('.reel-content');
        const symbolEls = reelContent ? reelContent.querySelectorAll('.symbol') : null;
        const cellEl = symbolEls ? symbolEls[pos.row] : null;
        if (!cellEl) {
            return Promise.resolve();
        }

        const outcome = outcomes[idx];
        if (outcome === 'xWays') {
            const replacement = xWaysReplacementSymbol || payableSymbols[Math.floor(Math.random() * payableSymbols.length)];
            const mult = randomInt(2, 7);

            namesGrid[pos.reel][pos.row] = replacement;
            weightsGrid[pos.reel][pos.row] = mult;

            currentBoard[pos.reel][pos.row] = replacement;
            currentBoardMult[pos.reel][pos.row] = mult;

            return animateCellSpin(cellEl, replacement, duration).then(() => {
                const badge = document.createElement('span');
                badge.className = 'symbol-mult';
                badge.textContent = `x${mult}`;
                cellEl.appendChild(badge);
            });
        }

        // high/wild
        namesGrid[pos.reel][pos.row] = outcome;
        weightsGrid[pos.reel][pos.row] = 1;

        currentBoard[pos.reel][pos.row] = outcome;
        currentBoardMult[pos.reel][pos.row] = 1;

        return animateCellSpin(cellEl, outcome, duration);
    });

    await Promise.all(tasks);

    // После замены пересчитываем линии (особенно если появились новые xWays-множители)
    setLinesCounter(calculateTotalLinesFromWeights(weightsGrid));

    return { namesGrid, weightsGrid, xWaysReplacementSymbol };
}

function setLinesCounter(value) {
    const el = document.getElementById('linesCounter');
    if (!el) return;
    el.textContent = `Линий: ${Math.round(value)}`;
}

function calculateTotalLinesFromWeights(weightsGrid) {
    let total = 1;
    for (let reel = 0; reel < NUM_REELS; reel++) {
        const sum = (weightsGrid?.[reel] || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
        total *= sum || (weightsGrid[reel] ? weightsGrid[reel].length : VISIBLE_ROWS);
    }
    return total;
}

function hideWinHud() {
    const winHud = document.getElementById('winHud');
    const winElement = document.getElementById('winAmount');

    if (winHud) {
        // Плавно скрываем за 0.2с
        winHud.classList.add('fade-out');

        setTimeout(() => {
            // На случай если уже показали новый выигрыш
            if (winHud.classList.contains('fade-out')) {
                winHud.style.display = 'none';
                winHud.classList.remove('fade-out');
            }
        }, 200);
    }

    if (winElement) {
        winElement.textContent = '0.00';
        winElement.style.color = '#3ee8a8';
        winElement.style.animation = 'none';
    }
}

let winPresentationTimeout = null;
let winOverlayCountTimeout = null;
let winOverlayCountRaf = null;
let winOverlayExitTimeout = null;
let winOverlayCountEndResolve = null;

function clearWinPresentation() {
    if (winOverlayCountEndResolve) {
        const r = winOverlayCountEndResolve;
        winOverlayCountEndResolve = null;
        r();
    }

    if (winPresentationTimeout) {
        clearTimeout(winPresentationTimeout);
        winPresentationTimeout = null;
    }

    if (winOverlayCountTimeout) {
        clearTimeout(winOverlayCountTimeout);
        winOverlayCountTimeout = null;
    }

    if (winOverlayExitTimeout) {
        clearTimeout(winOverlayExitTimeout);
        winOverlayExitTimeout = null;
    }

    if (winOverlayCountRaf) {
        cancelAnimationFrame(winOverlayCountRaf);
        winOverlayCountRaf = null;
    }

    document.querySelectorAll('.symbol.win-highlight').forEach(el => {
        el.classList.remove('win-highlight');
    });

    const overlay = document.getElementById('winOverlay');
    if (overlay) {
        overlay.classList.remove('animate');
        overlay.classList.remove('exit');
        overlay.style.display = 'none';
    }
    
    const bigWinOverlay = document.getElementById('bigWinOverlay');
    if (bigWinOverlay) {
        bigWinOverlay.style.display = 'none';
    }
    
    // Stop all BW music
    const bwAudioIds = ['bw1Music', 'bw2Music', 'bw3Music', 'bw4Music', 'bw5Music', 'bw6Music', 'bwEndMusic'];
    bwAudioIds.forEach(id => {
        const a = document.getElementById(id);
        if (a) {
            a.pause();
            a.currentTime = 0;
        }
    });

}

async function doBigWinPresentation(targetWin, baseBet, linesCount) {
    const bigWinOverlay = document.getElementById('bigWinOverlay');
    const bwText = document.getElementById('bigWinText');
    const bwAmount = document.getElementById('bigWinAmount');
    if (!bigWinOverlay || !bwText || !bwAmount) return;

    // Сначала показываем только линии (через стандартный overlay) или ничего, но мы обещали ждать 1 секунду.
    const overlay = document.getElementById('winOverlay');
    const overlayAmount = document.getElementById('winOverlayAmount');
    const overlayLines = document.getElementById('winOverlayLines');
    
    if (overlay && overlayAmount && overlayLines) {
        overlayAmount.textContent = '';
        overlayLines.textContent = `Линий: ${linesCount}`;
        overlay.style.display = 'flex';
        overlay.classList.remove('exit');
    }

    // Запоминаем статус музыки
    const isBgPlaying = bgAudioEl && !bgAudioEl.paused;
    const isBonusPlaying = currentBonusAudio && !currentBonusAudio.paused;

    // Пауза 1с перед началом Big Win (музыка пока еще играет)
    await sleep(1000);
    
    // Музыка на паузу при начале экрана
    if (bgAudioEl) bgAudioEl.pause();
    if (currentBonusAudio) currentBonusAudio.pause();
    
    if (overlay) overlay.style.display = 'none';
    
    bigWinOverlay.style.display = 'flex';
    bwAmount.textContent = '0.00';

    const winMulti = targetWin / baseBet;

    const stages = [
        { name: 'BIG WIN!', startMulti: 0, endMulti: 25, duration: 5800, audio: 'bw1Music' },
        { name: 'SUPER WIN!', startMulti: 25, endMulti: 50, duration: 4900, audio: 'bw2Music' },
        { name: 'MEGA WIN!', startMulti: 50, endMulti: 100, duration: 8150, audio: 'bw3Music' },
        { name: 'EPIC WIN!', startMulti: 100, endMulti: 250, duration: 7700, audio: 'bw4Music' },
        { name: 'ULTRA WIN!', startMulti: 250, endMulti: 500, duration: 6800, audio: 'bw5Music' },
        { name: 'ROAD TO MAX?', startMulti: 500, endMulti: Infinity, duration: 7000, audio: 'bw6Music' }
    ];

    let currentStartMulti = 0;
    
    for (const stage of stages) {
        if (winMulti <= stage.startMulti) break; // Мы уже достигли финальной стадии на прошлом шаге

        bwText.textContent = stage.name;
        
        const stageAudio = document.getElementById(stage.audio);
        if (stageAudio) {
            stageAudio.currentTime = 0;
            stageAudio.play().catch(() => {});
        }

        const isFinalStage = winMulti <= stage.endMulti;
        const targetMultiForStage = isFinalStage ? winMulti : stage.endMulti;

        const startAmount = currentStartMulti * baseBet;
        const targetAmount = targetMultiForStage * baseBet;
        const duration = stage.duration;

        await new Promise(resolve => {
            const startPerf = performance.now();
            
            const tick = (now) => {
                const elapsed = now - startPerf;
                let t = elapsed / duration;
                if (t >= 1) t = 1;
                
                // Геометрическая прогрессия замедления - используем easeOutCubic
                const easeT = 1 - Math.pow(1 - t, 3);
                
                const currentVal = startAmount + (targetAmount - startAmount) * easeT;
                bwAmount.textContent = currentVal.toFixed(2);
                
                if (t < 1) {
                    winOverlayCountRaf = requestAnimationFrame(tick);
                } else {
                    bwAmount.textContent = targetAmount.toFixed(2);
                    resolve();
                }
            };
            winOverlayCountRaf = requestAnimationFrame(tick);
        });

        if (stageAudio) {
            stageAudio.pause();
        }

        currentStartMulti = targetMultiForStage;
        if (isFinalStage) {
            break; // Finished counting
        }
    }

    // Конечная стадия
    const bwEnd = document.getElementById('bwEndMusic');
    if (bwEnd) {
        bwEnd.currentTime = 0;
        bwEnd.play().catch(() => {});
    }

    // Возвращаем основную музыку сразу вместе с bwend
    if (isBonusPlaying) playBonusForCount(bonusScatterCount);
    else if (isBgPlaying && bgAudioEl) bgAudioEl.play().catch(() => {});

    // Мгновенно убираем текст "BIG WIN", "MEGA WIN" и т.п.
    bwText.style.visibility = 'hidden';
    
    // Мгновенно убираем темный фон
    bigWinOverlay.style.background = 'transparent';

    // Счетчик улетает вверх в прозрачность
    bwAmount.classList.add('amount-exit');
    
    // Ждем окончания анимации
    await sleep(2500);
    
    bigWinOverlay.style.display = 'none';

    // Очищаем классы/стили для следующего биг вина
    bwText.style.visibility = 'visible';
    bwAmount.classList.remove('amount-exit');
    bigWinOverlay.style.background = '';
}

function showWinPresentation(winInfo) {
    clearWinPresentation();

    const countEndPromise = new Promise((resolve) => {
        winOverlayCountEndResolve = resolve;
    });

    applyWinHighlights(winInfo.highlights);

    const targetWin = Number(winInfo.totalWin) || 0;
    const baseBet = Number(currentBaseBet) || 1;

    if (targetWin > 15 * baseBet) {
        doBigWinPresentation(targetWin, baseBet, Math.round(winInfo.totalWays)).then(() => {
            if (winOverlayCountEndResolve) {
                const r = winOverlayCountEndResolve;
                winOverlayCountEndResolve = null;
                r();
            }
        });
        return countEndPromise;
    }

    const overlay = document.getElementById('winOverlay');
    const overlayAmount = document.getElementById('winOverlayAmount');
    const overlayLines = document.getElementById('winOverlayLines');

    if (overlay && overlayAmount && overlayLines) {
        const targetWin = Number(winInfo.totalWin) || 0;
        overlayAmount.textContent = '0.00';
        overlayLines.textContent = `Линий: ${Math.round(winInfo.totalWays)}`;
        overlay.style.display = 'flex';

        overlay.classList.remove('exit');

        // 0.3с показываем 0.00, затем за 0.7с досчитываем до выигрыша,
        // затем 0.5с держим финальное значение, и только потом уезжаем вверх/исчезаем.
        const holdZeroMs = 300;
        const countMs = 700;
        const holdFinalMs = 500;
        const exitMs = 600;

        winOverlayCountTimeout = setTimeout(() => {
            winOverlayCountTimeout = null;
            const start = performance.now();

            const tick = (now) => {
                const t = Math.min((now - start) / countMs, 1);
                const value = targetWin * t;
                overlayAmount.textContent = value.toFixed(2);
                if (t < 1) {
                    winOverlayCountRaf = requestAnimationFrame(tick);
                } else {
                    winOverlayCountRaf = null;
                    overlayAmount.textContent = targetWin.toFixed(2);

                    if (winOverlayCountEndResolve) {
                        const r = winOverlayCountEndResolve;
                        winOverlayCountEndResolve = null;
                        r();
                    }

                    // Держим финал 0.5с, затем запускаем уход
                    winOverlayExitTimeout = setTimeout(() => {
                        winOverlayExitTimeout = null;
                        overlay.classList.add('exit');
                    }, holdFinalMs);
                }
            };

            winOverlayCountRaf = requestAnimationFrame(tick);
        }, holdZeroMs);

        // Чистим оверлей после завершения выхода
        winPresentationTimeout = setTimeout(() => {
            clearWinPresentation();
        }, holdZeroMs + countMs + holdFinalMs + exitMs);
    }

    // Если оверлей не отрисован (нет DOM) — не блокируем UI
    if (!(overlay && overlayAmount && overlayLines)) {
        if (winOverlayCountEndResolve) {
            const r = winOverlayCountEndResolve;
            winOverlayCountEndResolve = null;
            r();
        }
    }

    return countEndPromise;
}

function applyWinHighlights(highlights) {
    if (!highlights || highlights.length === 0) return;

    for (const pos of highlights) {
        // Если это бонусная игра и нижний ряд (row === 2), пытаемся подсветить окошко enhancer
        if (isBonusGame && pos.row === 2) {
            const enhancer = document.getElementById(`enhancer${pos.reel}`);
            if (enhancer && enhancer.classList.contains('active')) {
                const enhancerContent = enhancer.querySelector('.enhancer-content');
                if (enhancerContent) {
                    const enhancerSymbols = enhancerContent.querySelectorAll('.symbol');
                    if (enhancerSymbols.length > 0) {
                        enhancerSymbols[0].classList.add('win-highlight');
                    }
                }
            }
        }

        const reel = document.getElementById(`reel${pos.reel}`);
        if (!reel) continue;
        const reelContent = reel.querySelector('.reel-content');
        if (!reelContent) continue;

        const symbols = reelContent.querySelectorAll('.symbol');
        // После спина финальные символы находятся в начале ленты (индексы 0..2)
        const targetIndex = pos.row;
        const el = symbols[targetIndex];
        if (el) el.classList.add('win-highlight');
    }
}

// Генерирование полного результата 5x3 (5 барабанов по 3 символа)
// scatterGuarantee:
// - 0: обычный спин
// - 1: гарантирует scatter на 2-м барабане, остальные scatter могут выпадать по обычным весам
// - 3/4/5: гарантирует РОВНО столько scatter на поле
// Во всех режимах: максимум 1 scatter на барабан.
function generateResult(scatterGuarantee = 0) {
    // Иначе — стандартная генерация (случайная)
    const scatterIndex = SYMBOLS.indexOf('scatter');

    const pickRandomNonScatterIndex = () => {
        if (scatterIndex < 0) return getRandomSymbolIndex(isBonusGame);
        // Подбираем случайный символ, но исключаем scatter (в бонусе scatter сразу с нулевым весом)
        for (let attempts = 0; attempts < 40; attempts++) {
            const idx = getRandomSymbolIndex(isBonusGame);
            if (idx !== scatterIndex) return idx;
        }
        // Фолбэк: первый не-scatter
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
            // Для модов 3/4/5 сначала генерируем поле без scatter,
            // чтобы потом расставить РОВНО нужное количество.
            // Для 0/1 — scatter разрешён по обычным весам (не в бонусной игре).
            const allowScatterByWeights = !isBonusGame && (scatterGuarantee === 0 || scatterGuarantee === 1);
            let idx = allowScatterByWeights ? getRandomSymbolIndex() : pickRandomNonScatterIndex();

            // Правило: на одном барабане не может быть больше одного scatter
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
        console.log(`Барабан ${reel}: [${reelSymbols.map(i => SYMBOLS[i]).join(', ')}]`);
    }

    // Если нужен гарантированный scatter — выставляем РОВНО N штук, по одному на барабан (только базовая игра)
    if (!isBonusGame && scatterGuarantee > 0 && scatterIndex >= 0) {
        let actualScatterCount = scatterGuarantee;
        if (scatterGuarantee === 202) {
            const r = Math.random();
            if (r < 0.20) actualScatterCount = 3;
            else if (r < 0.80) actualScatterCount = 4;
            else actualScatterCount = 5;
        }

        // Спец-правило: мод "1 скаттер" — строго на 2-м барабане и только один
        if (actualScatterCount === 1) {
            const forcedReel = 1; // 2-й барабан
            const forcedRow = 1;  // центр
            result[forcedReel][forcedRow] = scatterIndex;

            // На одном барабане не может быть больше одного scatter:
            // убираем scatter с других рядов этого барабана, если он туда попал по весам.
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (row === forcedRow) continue;
                if (result[forcedReel][row] === scatterIndex) {
                    result[forcedReel][row] = pickRandomNonScatterIndex();
                }
            }
        } else {
            let pickedReels = [];
            if (scatterGuarantee === 202) {
                // первые 3 гарантированно на 0, 1, 2
                pickedReels = [0, 1, 2];
                if (actualScatterCount > 3) {
                    let rem = [3, 4];
                    rem.sort(() => 0.5 - Math.random());
                    pickedReels.push(...rem.slice(0, actualScatterCount - 3));
                }
            } else {
                const count = Math.min(NUM_REELS, Math.max(0, Math.floor(actualScatterCount)));
                const reels = [0, 1, 2, 3, 4];
                for (let i = reels.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [reels[i], reels[j]] = [reels[j], reels[i]];
                }
                pickedReels = reels.slice(0, count);
            }

            for (const r of pickedReels) {
                const row = Math.floor(Math.random() * VISIBLE_ROWS);
                result[r][row] = scatterIndex;
            }
        }
    }

    // Если бонусный режим
    if (isBonusGame) {
        const enhancerReels = getBonusEnhancerReels();
        const enhancerPool = ['high1', 'high2', 'high3', 'high4', 'high5', 'wild', 'xWays', 'split'];
        // В бонуске нижние символы (индекс 2) заменяются на энхансеры
        for (const r of enhancerReels) {
            const sym = enhancerPool[Math.floor(Math.random() * enhancerPool.length)];
            result[r][2] = SYMBOLS.indexOf(sym); // Меняем именно 3-й ряд (нижний)
        }

        // Шанс дропа скаттера на 5-м или 1-м барабане для дополнительных фри-спинов
        if (bonusScatterCount === 3 && Math.random() < 0.04) {
            const row = Math.floor(Math.random() * VISIBLE_ROWS);
            result[4][row] = scatterIndex;
        } else if (bonusScatterCount === 4 && Math.random() < 0.05) {
            const row = Math.floor(Math.random() * VISIBLE_ROWS);
            result[0][row] = scatterIndex;
        }
    }

    return result;
}

/** Высота ленты в px для барабана (как в spinReel), без DOM-манипуляций */
function getReelSpinStartOffsetPx(reelIndex, finalSymbols, extraDurationMs = 0) {
    const symbolHeight = getSymbolHeight();
    const totalDuration = Math.max(1, SPIN_DURATION + (Number(extraDurationMs) || 0));
    const numVisible = Math.min(3, finalSymbols.length);
    const baseSpinSymbols = SYMBOLS.length * NUM_SPINS_PER_REEL;
    const totalSpinSymbols = Math.max(1, Math.ceil(baseSpinSymbols * (totalDuration / SPIN_DURATION)));
    return (numVisible + totalSpinSymbols) * symbolHeight;
}

/** Смещение ленты translateY (px) от начала локального времени барабана */
function computeReelSpinOffsetPx(startOffset, scrollV, tDecelStart, decelMs, elapsed) {
    const so = Math.max(0, Number(startOffset) || 0);
    const v = Math.max(1e-6, Number(scrollV) || 0);
    const t0 = Math.max(0, Number(tDecelStart) || 0);
    const dm = Math.max(1, Number(decelMs) || 1);
    const t = Math.max(0, Number(elapsed) || 0);

    if (t < t0) {
        return Math.max(0, so - v * t);
    }
    const u = Math.min((t - t0) / dm, 1);
    const offAtDecel = Math.max(0, so - v * t0);
    return offAtDecel * (1 - easeOutCubic(u));
}

// Прокрутка барабанов
// resolvedWeightsHint — опционально 5×3 весов из книги: правильные бейджи xN на финальной ленте и в окошках во время спина
function spinReels(finalResult, resolvedWeightsHint = null) {
    const spinPromises = [];

    // Если по финальному полю видно, что к моменту остановки покажется 2 scatter,
    // и впереди есть ещё барабаны — замедляем/удлиняем остановку следующих барабанов:
    // каждый следующий +4 секунды (и продолжает крутиться).
    const scatterReels = [];
    for (let reel = 0; reel < NUM_REELS; reel++) {
        const hasScatter = (finalResult?.[reel] || []).some((idx) => SYMBOLS[idx] === 'scatter');
        if (hasScatter) scatterReels.push(reel);
    }

    let secondScatterReel = -1;
    if (scatterReels.length >= 2) {
        scatterReels.sort((a, b) => a - b);
        secondScatterReel = scatterReels[1];
    }

    const slowdownEnabled = (secondScatterReel >= 0 && secondScatterReel < NUM_REELS - 1);
    scatterGlowArmed = slowdownEnabled;
    scatterGlowActive = false;
    scatterGlowSecondScatterReel = slowdownEnabled ? secondScatterReel : -1;
    clearScatterGlow();
    clearReelSlowGlow();

    const extraByReel = [];
    for (let i = 0; i < NUM_REELS; i++) {
        let extraDurationMs = (secondScatterReel >= 0 && secondScatterReel < NUM_REELS - 1 && i > secondScatterReel)
            ? (i - secondScatterReel) * 4000
            : (isBonusGame ? 1000 : 0);

        if (bonusModifier === 'specchain' && bonusHighlightedReels.includes(i)) {
            if (bonusHighlightedReels[0] > 0) {
                extraDurationMs += 4000;
            }
        }
        extraByReel[i] = extraDurationMs;
    }

    const symbolHeight = getSymbolHeight();
    const baseTotalDuration = Math.max(1, SPIN_DURATION + extraByReel[0]);
    const baseSpinSymbols = Math.max(1, Math.ceil((SYMBOLS.length * NUM_SPINS_PER_REEL) * (baseTotalDuration / SPIN_DURATION)));
    const s0 = (Math.min(3, finalResult[0].length) + baseSpinSymbols) * symbolHeight;

    const scrollV = (REEL_SPIN_LINEAR_FRAC * s0) / REEL_SPIN_BASE_LINEAR_MS;
    const decelDistance = Math.max(0, s0 - scrollV * REEL_SPIN_BASE_LINEAR_MS);

    const tDecelStartByReel = [];
    const totalSpinSymbolsByReel = [];
    const enhancerTDecelStartByReel = [];
    const enhancerTotalSpinSymbolsByReel = [];

    const stopQueue = [];
    const enhancerReels = isBonusGame ? getBonusEnhancerReels() : [];
    
    if (isBonusGame) {
        for (let i = 0; i < NUM_REELS; i++) {
            if (enhancerReels.includes(i)) {
                stopQueue.push({ type: 'enhancer', reelIndex: i });
                const enhancer = document.getElementById(`enhancer${i}`);
                if (enhancer) enhancer.classList.add('scatter-glow');
            }
        }
    }
    for (let i = 0; i < NUM_REELS; i++) {
        stopQueue.push({ type: 'main', reelIndex: i });
    }

    let isFirstStop = true;
    let prevAbsTDecel = 0;

    for (const item of stopQueue) {
        const i = item.reelIndex;
        const delay = i * REEL_START_STAGGER_MS;
        
        let absTDecel;
        if (isFirstStop) {
            absTDecel = delay + REEL_SPIN_BASE_LINEAR_MS + extraByReel[i];
            isFirstStop = false;
        } else {
            absTDecel = Math.max(
                prevAbsTDecel + getReelStopStaggerMs(),
                delay + REEL_SPIN_BASE_LINEAR_MS + extraByReel[i]
            );
        }

        let localTDecel = Math.max(0, absTDecel - delay);
        let numVisible = item.type === 'main' ? Math.min(3, finalResult[i].length) : 1;
        
        let requiredOffset = scrollV * localTDecel + decelDistance;
        let neededSymbols = Math.ceil(requiredOffset / symbolHeight) - numVisible;
        neededSymbols = Math.max(1, neededSymbols);
        
        let actualOffset = (numVisible + neededSymbols) * symbolHeight;
        localTDecel = Math.max(0, (actualOffset - decelDistance) / scrollV);
        
        if (item.type === 'main') {
            tDecelStartByReel[i] = localTDecel;
            totalSpinSymbolsByReel[i] = neededSymbols;
        } else {
            enhancerTDecelStartByReel[i] = localTDecel;
            enhancerTotalSpinSymbolsByReel[i] = neededSymbols;
        }
        
        prevAbsTDecel = delay + localTDecel;
    }

    for (let i = 0; i < NUM_REELS; i++) {
        spinPromises.push(spinReel(i, finalResult[i], extraByReel[i], scrollV, tDecelStartByReel[i], totalSpinSymbolsByReel[i], resolvedWeightsHint?.[i]));

        if (isBonusGame && enhancerReels.includes(i)) {
            spinPromises.push(spinEnhancerReel(i, finalResult[i][2], extraByReel[i], scrollV, enhancerTDecelStartByReel[i], enhancerTotalSpinSymbolsByReel[i], resolvedWeightsHint?.[i]?.[2]));
        }
    }

    return Promise.all(spinPromises);
}

// Сброс барабанов на финальные позиции
function resetReelsToFinalPosition() {
    const symbolHeight = getSymbolHeight();
    for (let i = 0; i < NUM_REELS; i++) {
        const reel = document.getElementById(`reel${i}`);
        const reelContent = reel.querySelector('.reel-content');
        
        // Устанавливаем смещение только на нужную позицию
        const offset = reelPositions[i] * symbolHeight;
        reelContent.style.transform = `translateY(-${offset}px)`;
        reelContent.style.transition = 'none'; // Убираем переход для мгновенного применения
    }
}

function spinEnhancerReel(reelIndex, enhancerSymbolIndex, extraDurationMs = 0, scrollVPxPerMs, tDecelStartMs, forcedSpinSymbols = 0, resolvedBottomWeight = undefined) {
    return new Promise((resolve) => {
        const enhancer = document.getElementById(`enhancer${reelIndex}`);
        const enhancerContent = enhancer.querySelector('.enhancer-content');
        if (!enhancerContent || !enhancer.classList.contains('active')) {
            resolve();
            return;
        }

        enhancer.classList.add('scatter-glow');
        
        const symbolHeight = getSymbolHeight();
        const totalDuration = Math.max(1, SPIN_DURATION + (Number(extraDurationMs) || 0));
        
        let htmlParts = [];
        
        // 1) Финальный символ (виден в конце): до резолва показываем split вместо split_wilds; xWays остаётся xWays до resolveXWays
        const rawFinalName = SYMBOLS[enhancerSymbolIndex] || enhancerSymbolIndex;
        const landingSymbolName = rawFinalName === 'split_wilds' ? 'split' : rawFinalName;

        let badgeHtml = '';
        const multEligible =
            resolvedBottomWeight === undefined
                ? null
                : (Number(resolvedBottomWeight) || 1);

        if (multEligible != null && multEligible > 1 && landingSymbolName !== 'split' && landingSymbolName !== 'xWays') {
            if (!['wild', 'split'].includes(landingSymbolName) && [1, 2, 3].includes(reelIndex)) {
                badgeHtml = `<span class="symbol-mult">x${multEligible}</span>`;
            }
        } else if (resolvedBottomWeight === undefined && isBonusGame && getBonusEnhancerReels().includes(reelIndex)) {
            if (!['xWays', 'wild', 'split'].includes(landingSymbolName)) {
                if ([1, 2, 3].includes(reelIndex)) {
                    badgeHtml = `<span class="symbol-mult">x${bonusEnhancerMults[reelIndex]}</span>`;
                }
            }
        }

        htmlParts.push(`<div class="symbol"><img src="images/${landingSymbolName}.png" alt="${landingSymbolName}">${badgeHtml}</div>`);
        
        // 2) Рандомные символы
        let totalSpinSymbols = Number(forcedSpinSymbols) || 0;
        if (totalSpinSymbols <= 0) {
            const spinTime = Math.max(500, SPIN_DURATION - 500 + (Number(extraDurationMs) || 0));
            const baseSpinSymbols = SYMBOLS.length * NUM_SPINS_PER_REEL;
            totalSpinSymbols = Math.max(1, Math.ceil(baseSpinSymbols * (spinTime / SPIN_DURATION)));
        }
        for (let i = 0; i < totalSpinSymbols; i++) {
            const rndSymbol = getRandomSymbolName();
            htmlParts.push(`<div class="symbol"><img src="images/${rndSymbol}.png" alt="${rndSymbol}"></div>`);
        }
        
        // 3) Текущий символ (старый) - берем из DOM
        const currentImg = enhancerContent.querySelector('img');
        const currentName = currentImg ? currentImg.alt : 'high1';
        htmlParts.push(`<div class="symbol"><img src="images/${currentName}.png" alt="${currentName}"></div>`);
        
        enhancerContent.style.transition = 'none';
        enhancerContent.style.visibility = 'hidden';
        
        const startOffset = (1 + totalSpinSymbols) * symbolHeight;
        enhancerContent.style.transform = `translateY(-${startOffset}px)`;
        enhancerContent.getBoundingClientRect();
        
        enhancerContent.innerHTML = htmlParts.join('');
        enhancerContent.style.transform = `translateY(-${startOffset}px)`;
        
        requestAnimationFrame(() => {
            enhancerContent.style.visibility = 'visible';
        });
        
        const delay = reelIndex * REEL_START_STAGGER_MS;
        
        const scrollV = Math.max(1e-6, Number(scrollVPxPerMs) || 0);
        const tDecelStart = Math.max(0, Number(tDecelStartMs) || 0);
        const decelMs = REEL_DECEL_MS;
        const tDecelEnd = tDecelStart + decelMs;
        
        const controller = {
            reelIndex,
            started: false,
            fast: false,
            fastStart: 0,
            offAtFastStart: 0,
            startPerf: 0,
            startOffset,
            scrollV,
            tDecelStart,
            decelMs,
            tDecelEnd,
            startTimeoutId: null,
            startAnimation: null
        };
        activeEnhancerControllers[reelIndex] = controller;

        controller.startAnimation = () => {
            if (controller.started) return;
            controller.started = true;
            controller.startPerf = performance.now();

            const tick = () => {
                const now = performance.now();
                const elapsed = now - controller.startPerf;

                let currentOffset;
                let finished;

                if (controller.fast) {
                    if (now < controller.fastStart) {
                        currentOffset = computeReelSpinOffsetPx(
                            controller.startOffset,
                            controller.scrollV,
                            controller.tDecelStart,
                            controller.decelMs,
                            elapsed
                        );
                        finished = false;
                    } else {
                        const f = Math.min((now - controller.fastStart) / controller.decelMs, 1);
                        currentOffset = controller.offAtFastStart * (1 - easeOutCubic(f));
                        finished = f >= 1;
                    }
                } else {
                    currentOffset = computeReelSpinOffsetPx(
                        controller.startOffset,
                        controller.scrollV,
                        controller.tDecelStart,
                        controller.decelMs,
                        elapsed
                    );
                    finished = elapsed >= controller.tDecelEnd;
                }

                enhancerContent.style.transform = `translateY(-${currentOffset}px)`;

                if (finished) {
                    enhancerContent.style.transform = `translateY(0px)`;
                    const enhancerEl = document.getElementById(`enhancer${reelIndex}`);
                    if (enhancerEl) enhancerEl.classList.remove('reel-slow-glow', 'scatter-glow');
                    resolve();
                } else {
                    requestAnimationFrame(tick);
                }
            };
            requestAnimationFrame(tick);
        };

        controller.startTimeoutId = setTimeout(() => {
            controller.startTimeoutId = null;
            controller.startAnimation();
        }, delay);
    });
}

// Анимация раскрытия XWays в окошке: показывает, что конкретно раскрывается
async function revealEnhancerSymbol(reelIndex, enhancerSymbolIndex) {
    const enhancer = document.getElementById(`enhancer${reelIndex}`);
    if (!enhancer) return;
    const content = enhancer.querySelector('.enhancer-content');
    if (!content) return;

    // Если это xWays — показываем короткую анимацию открытия, затем заменяем на реальный символ
    const sym = SYMBOLS[enhancerSymbolIndex];
    if (sym === 'xWays' || sym === 'xWays') {
        // Анимируем: масштаб + вспышка
        content.style.transition = 'transform 220ms ease, opacity 220ms ease';
        content.style.transform = 'scale(1.15)';
        content.style.opacity = '1';
        await sleep(220);

        // Показать заменитель xWays (если есть глобально выбранный)
        const replacement = window.xWaysReplacementSymbol || null;
        const showName = replacement || 'high5';
        content.innerHTML = `<div class="symbol"><img src="images/${showName}.png" alt="${showName}"></div>`;

        // Небольшой пульс при раскрытии
        content.style.transform = 'scale(1)';
        await sleep(250);
    }
}

// Прокрутка одного барабана
// scrollVPxPerMs и tDecelStartMs задаются из spinReels: общая линейная скорость и момент начала торможения
function spinReel(reelIndex, finalSymbols, extraDurationMs = 0, scrollVPxPerMs, tDecelStartMs, forcedSpinSymbols = 0, finalWeightsRow = null) {
    return new Promise((resolve) => {
        const reel = document.getElementById(`reel${reelIndex}`);
        const reelContent = reel.querySelector('.reel-content');
        const symbolHeight = getSymbolHeight();

        const totalDuration = Math.max(1, SPIN_DURATION + (Number(extraDurationMs) || 0));

        // Берем ТЕКУЩИЕ символы из сохраненного состояния (не из DOM!)
        const currentSymbols = currentBoard[reelIndex];
        const currentMults = currentBoardMult[reelIndex];
        
        let htmlParts = [];
        let numVisible = Math.min(3, finalSymbols.length);
        
        // 1) Финальные символы (будут видны в конце) — split_wilds как split до resolveSplits; множители из книги если переданы
        for (let i = 0; i < numVisible; i++) {
            const rawName = SYMBOLS[finalSymbols[i]];
            const displayName = rawName === 'split_wilds' ? 'split' : rawName;
            let extraHtml = '';
            const wm = finalWeightsRow?.[i];
            if (wm != null && Number(wm) > 1) {
                extraHtml += `<span class="symbol-mult">x${wm}</span>`;
            }
            if (displayName === 'scatter' && isBonusGame) {
                if (reelIndex === 4 && bonusScatterCount === 3) extraHtml += `<span class="scatter-plus">+1</span>`;
                else if (reelIndex === 0 && bonusScatterCount === 4) extraHtml += `<span class="scatter-plus">+2</span>`;
            }
            htmlParts.push(`<div class="symbol"><img src="images/${displayName}.png" alt="${displayName}">${extraHtml}</div>`);
        }
        
        // 2) Рандомные символы для анимации
        let totalSpinSymbols = Number(forcedSpinSymbols) || 0;
        if (totalSpinSymbols <= 0) {
            const baseSpinSymbols = SYMBOLS.length * NUM_SPINS_PER_REEL;
            totalSpinSymbols = Math.max(1, Math.ceil(baseSpinSymbols * (totalDuration / SPIN_DURATION)));
        }
        for (let i = 0; i < totalSpinSymbols; i++) {
            const rndSymbol = getRandomSymbolName();
            htmlParts.push(`<div class="symbol"><img src="images/${rndSymbol}.png" alt="${rndSymbol}"></div>`);
        }
        
        // 3) Текущие символы (видны в начале)
        const numCurrent = Math.min(3, currentSymbols.length || 3);
        for (let i = 0; i < numCurrent; i++) {
            const mult = currentMults?.[i] || 1;
            let badge = mult > 1 ? `<span class="symbol-mult">x${mult}</span>` : '';
            const currentName = typeof currentSymbols[i] === 'number' ? SYMBOLS[currentSymbols[i]] : currentSymbols[i];
            if (currentName === 'scatter' && isBonusGame) {
                if (reelIndex === 4 && bonusScatterCount === 3) badge += `<span class="scatter-plus">+1</span>`;
                else if (reelIndex === 0 && bonusScatterCount === 4) badge += `<span class="scatter-plus">+2</span>`;
            }
            htmlParts.push(`<div class="symbol"><img src="images/${currentName}.png" alt="${currentName}">${badge}</div>`);
        }
        
        // ВАЖНО: чтобы не было мерцания финальной доски на 1 кадр,
        // сначала скрываем, сбрасываем позицию, затем меняем HTML и показываем.
        reelContent.style.transition = 'none';
        reelContent.style.visibility = 'hidden';

        // Стартовая позиция: показываем "текущие" (они внизу ленты)
        const startOffset = (numVisible + totalSpinSymbols) * symbolHeight;
        reelContent.style.transform = `translateY(-${startOffset}px)`;
        // Принудительный reflow: гарантируем применение transform ДО замены контента
        reelContent.getBoundingClientRect();

        reelContent.innerHTML = htmlParts.join('');
        reelContent.style.transform = `translateY(-${startOffset}px)`;

        // Показываем на следующем кадре, чтобы браузер не успел отрисовать старый offset
        requestAnimationFrame(() => {
            reelContent.style.visibility = 'visible';
        });
        
        // Конечная позиция: 0 (финальные вверху ленты становятся видимыми)
        const finalOffset = 0;
        
        const delay = reelIndex * REEL_START_STAGGER_MS;

        const scrollV = Math.max(1e-6, Number(scrollVPxPerMs) || 0);
        const tDecelStart = Math.max(0, Number(tDecelStartMs) || 0);
        const decelMs = REEL_DECEL_MS;
        const tDecelEnd = tDecelStart + decelMs;

        const controller = {
            reelIndex,
            started: false,
            fast: false,
            fastStart: 0,
            offAtFastStart: 0,
            startPerf: 0,
            startOffset,
            scrollV,
            tDecelStart,
            decelMs,
            tDecelEnd,
            startTimeoutId: null,
            startAnimation: null
        };
        activeReelControllers[reelIndex] = controller;

        controller.startAnimation = () => {
            if (controller.started) return;
            controller.started = true;
            controller.startPerf = performance.now();

            const tick = () => {
                const now = performance.now();
                const elapsed = now - controller.startPerf;

                let currentOffset;
                let finished;

                if (controller.fast) {
                    if (now < controller.fastStart) {
                        currentOffset = computeReelSpinOffsetPx(
                            controller.startOffset,
                            controller.scrollV,
                            controller.tDecelStart,
                            controller.decelMs,
                            elapsed
                        );
                        finished = false;
                    } else {
                        const f = Math.min((now - controller.fastStart) / controller.decelMs, 1);
                        currentOffset = controller.offAtFastStart * (1 - easeOutCubic(f));
                        finished = f >= 1;
                    }
                } else {
                    currentOffset = computeReelSpinOffsetPx(
                        controller.startOffset,
                        controller.scrollV,
                        controller.tDecelStart,
                        controller.decelMs,
                        elapsed
                    );
                    finished = elapsed >= controller.tDecelEnd;
                }

                reelContent.style.transform = `translateY(-${currentOffset}px)`;

                if (finished) {
                    reelContent.style.transform = `translateY(${finalOffset}px)`;

                    const scattersBefore = countScattersOnCurrentBoard();

                    currentBoard[reelIndex] = finalSymbols.map(i => SYMBOLS[i]);
                    currentBoardMult[reelIndex] = Array.from({ length: VISIBLE_ROWS }, () => 1);
                    
                    if (isBonusGame && getBonusEnhancerReels().includes(reelIndex)) {
                        const bottomSymName = currentBoard[reelIndex][2];
                        if (bottomSymName === 'split_wilds') {
                            currentBoardMult[reelIndex][2] = 2;
                        } else if (bottomSymName && !['xWays', 'wild', 'split'].includes(bottomSymName)) {
                            if ([1, 2, 3].includes(reelIndex)) {
                                currentBoardMult[reelIndex][2] = bonusEnhancerMults[reelIndex];
                            }
                        }
                    }

                    const scattersAfter = countScattersOnCurrentBoard();
                    pulseNewScatterIfMilestone(reelIndex, scattersBefore, scattersAfter);

                    if (scatterGlowArmed && reelIndex === scatterGlowSecondScatterReel) {
                        startScatterGlowUpToReel(reelIndex);
                        setReelSlowGlowForReelsStarting(reelIndex + 1);
                    } else if (scatterGlowActive) {
                        applyScatterGlowForReel(reelIndex);
                    }

                    const reelEl = document.getElementById(`reel${reelIndex}`);
                    if (reelEl) reelEl.classList.remove('reel-slow-glow');

                    reelPositions[reelIndex] = finalSymbols[0];
                    console.log(`Барабан ${reelIndex} остановился: [${finalSymbols.map(i => SYMBOLS[i]).join(', ')}]`);
                    resolve();
                } else {
                    requestAnimationFrame(tick);
                }
            };
            requestAnimationFrame(tick);
        };

        controller.startTimeoutId = setTimeout(() => {
            controller.startTimeoutId = null;
            controller.startAnimation();
        }, delay);
    });
}

function randomInt(minInclusive, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function easeOutBack(t) {
    // Резкий, дерзкий старт (без ускорения) и остановка с сильным отскоком
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutCubic(t) {
    const x = Math.min(Math.max(Number(t) || 0, 0), 1);
    return x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(t) {
    const x = Math.min(Math.max(Number(t) || 0, 0), 1);
    return 1 - Math.pow(1 - x, 3);
}

async function resolveSplitsAndUpdateBoardAnimated() {
    let hadSplits = false;
    for (let reel = 0; reel < NUM_REELS; reel++) {
        if (currentBoard[reel][2] === 'split') {
            hadSplits = true;
            
            // Visual split flash on the reel
            const reelEl = document.getElementById(`reel${reel}`);
            if (reelEl) {
                const flash = document.createElement('div');
                flash.style.position = 'absolute';
                flash.style.bottom = '0';
                flash.style.left = '50%';
                flash.style.width = '6px';
                flash.style.height = '0%';
                flash.style.background = '#fff';
                flash.style.boxShadow = '0 0 20px #5ce1ff, 0 0 40px #f471b5';
                flash.style.transform = 'translateX(-50%)';
                flash.style.zIndex = '20';
                flash.style.transition = 'height 0.3s ease-out, opacity 0.3s ease-in';
                flash.style.borderRadius = '3px';
                reelEl.appendChild(flash);
                
                // Animate flash
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        flash.style.height = '100%';
                    });
                });
                setTimeout(() => {
                    flash.style.opacity = '0';
                    setTimeout(() => flash.remove(), 300);
                }, 300);
            }

            await sleep(350);

            // Double the multiplier of row 0 and 1
            for (let row = 0; row < 2; row++) {
                currentBoardMult[reel][row] = (currentBoardMult[reel][row] || 1) * 2;
                // Update DOM badge
                const reelContent = reelEl ? reelEl.querySelector('.reel-content') : null;
                const symbolEls = reelContent ? reelContent.querySelectorAll('.symbol') : null;
                const el = symbolEls ? symbolEls[row] : null;
                
                if (el) {
                    let badge = el.querySelector('.symbol-mult');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'symbol-mult';
                        el.appendChild(badge);
                    }
                    badge.textContent = `x${currentBoardMult[reel][row]}`;
                    
                    // Small pop animation
                    el.style.transition = 'transform 0.15s ease-out';
                    el.style.transform = 'scale(1.15)';
                    setTimeout(() => el.style.transform = 'scale(1)', 150);
                }
            }

            // Convert split to split_wilds
            currentBoard[reel][2] = 'split_wilds';
            currentBoardMult[reel][2] = 2; // split_wilds is x2 wild
            
            const enhancer = document.getElementById(`enhancer${reel}`);
            const enhancerContent = enhancer ? enhancer.querySelector('.enhancer-content') : null;
            const splitEl = enhancerContent ? enhancerContent.querySelectorAll('.symbol')[0] : null;
            
            if (splitEl) {
                splitEl.innerHTML = `<img src="images/split_wilds.png" alt="split_wilds">`;
                splitEl.style.transition = 'transform 0.15s ease-out';
                splitEl.style.transform = 'scale(1.15)';
                setTimeout(() => splitEl.style.transform = 'scale(1)', 150);
            }

            // Add +2 to persistent multiplier if reel is 1, 2, or 3
            if ([1, 2, 3].includes(reel)) {
                bonusEnhancerMults[reel] += 2;
            }
        }
    }
    return hadSplits;
}

// После остановки барабанов: если есть xWays —
// 1) пауза 0.5с,
// 2) мерцание между xWays и выбранным символом,
// 3) окончательная замена + бейдж x2..x6,
// Возвращает сетку для расчёта выигрыша (namesGrid + weightsGrid).
// presetSpin — запись книги: замена и множители xWays из сида, без повторного RNG.
async function resolveXWaysAndUpdateBoardAnimated(presetSpin = null) {
    const payableSymbols = Object.keys(PAYOUTS);
    const namesGrid = Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => ''));
    const weightsGrid = Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => 1));

    const xWaysPositions = [];

    for (let reel = 0; reel < NUM_REELS; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const original = currentBoard[reel][row];
            namesGrid[reel][row] = original;
            weightsGrid[reel][row] = currentBoardMult[reel][row] || 1;

            if (original === 'xWays') {
                xWaysPositions.push({ reel, row });
            }
        }
    }

    if (xWaysPositions.length === 0) {
        return { namesGrid, weightsGrid, hadXWays: false, xWaysReplacementSymbol: null };
    }

    let replacementSymbol;
    if (presetSpin) {
        const p0 = xWaysPositions[0];
        replacementSymbol = SYMBOLS[presetSpin[`reel${p0.reel}`][p0.row]];
    } else {
        replacementSymbol = payableSymbols[Math.floor(Math.random() * payableSymbols.length)];
    }

    // Собираем элементы DOM, чтобы мерцать одновременно
    const targets = [];
    for (const pos of xWaysPositions) {
        const reelEl = document.getElementById(`reel${pos.reel}`);
        const reelContent = reelEl?.querySelector('.reel-content');
        const symbolEls = reelContent ? reelContent.querySelectorAll('.symbol') : null;
        let el = symbolEls ? symbolEls[pos.row] : null;

        // Если это бонусная игра и нижний ряд (row === 2), проверяем, активен ли enhancer
        if (isBonusGame && pos.row === 2) {
            const enhancer = document.getElementById(`enhancer${pos.reel}`);
            if (enhancer && enhancer.classList.contains('active')) {
                const enhancerContent = enhancer.querySelector('.enhancer-content');
                if (enhancerContent) {
                    // Используем DOM-элемент enhancer-а вместо основного
                    const enhancerSymbolEls = enhancerContent.querySelectorAll('.symbol');
                    if (enhancerSymbolEls.length > 0) {
                        el = enhancerSymbolEls[0]; // берем первый элемент (он виден при translateY 0px)
                    }
                }
            }
        }

        if (!el) continue;

        const img = el.querySelector('img');
        const oldBadge = el.querySelector('.symbol-mult');
        if (oldBadge) oldBadge.remove();

        targets.push({ ...pos, el, img });
    }

    // Пауза после остановки
    await sleep(500);

    // Мерцание: переключаем src xWays <-> replacement
    const flickerDuration = 420;
    const flickerStep = 70;
    const steps = Math.max(1, Math.floor(flickerDuration / flickerStep));
    let showReplacement = false;

    for (let i = 0; i < steps; i++) {
        showReplacement = !showReplacement;
        for (const t of targets) {
            if (!t.img) continue;
            t.img.src = showReplacement ? `images/${replacementSymbol}.png` : 'images/xWays.png';
            t.img.alt = showReplacement ? replacementSymbol : 'xWays';
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(flickerStep);
    }

    // Финальная замена + запись в состояние
    for (const t of targets) {
        let finalSym;
        let finalMult;

        if (presetSpin) {
            finalSym = SYMBOLS[presetSpin[`reel${t.reel}`][t.row]];
            finalMult = Number(presetSpin.weights[t.reel][t.row]) || 1;
        } else {
            const baseMult = currentBoardMult[t.reel][t.row] || 1;
            const xWaysMult = randomInt(2, 7);
            finalMult = baseMult * xWaysMult;
            finalSym = replacementSymbol;
        }

        namesGrid[t.reel][t.row] = finalSym;
        weightsGrid[t.reel][t.row] = finalMult;

        currentBoard[t.reel][t.row] = finalSym;
        currentBoardMult[t.reel][t.row] = finalMult;

        if (t.img) {
            t.img.src = `images/${finalSym}.png`;
            t.img.alt = finalSym;
        }

        if (finalSym !== 'split_wilds' && finalMult > 1) {
            const badge = document.createElement('span');
            badge.className = 'symbol-mult';
            badge.textContent = `x${finalMult}`;
            t.el.appendChild(badge);
        }

        if (isBonusGame && t.row === 2) {
            const reelEl = document.getElementById(`reel${t.reel}`);
            const reelSymbol = reelEl?.querySelector('.reel-content')?.querySelectorAll('.symbol')?.[2];
            if (reelSymbol) {
                const img = reelSymbol.querySelector('img');
                if (img) {
                    img.src = `images/${finalSym}.png`;
                    img.alt = finalSym;
                }
                const oldReelBadge = reelSymbol.querySelector('.symbol-mult');
                if (oldReelBadge) oldReelBadge.remove();
                if (finalSym !== 'split_wilds' && finalMult > 1) {
                    const newReelBadge = document.createElement('span');
                    newReelBadge.className = 'symbol-mult';
                    newReelBadge.textContent = `x${finalMult}`;
                    reelSymbol.appendChild(newReelBadge);
                }
            }
        }
    }

    // После превращения пересчитываем количество возможных линий
    setLinesCounter(calculateTotalLinesFromWeights(weightsGrid));

    return { namesGrid, weightsGrid, hadXWays: true, xWaysReplacementSymbol: replacementSymbol };
}

// === БОНУСНАЯ ИГРА ===
function initBonus(scatterCount) {
    isBonusGame = true;
    bonusScatterCount = Math.min(5, Math.max(3, Math.floor(Number(scatterCount)) || 3));
    bonusSpinsTotal = { 3: 7, 4: 8, 5: 10 }[bonusScatterCount] || 0;

    bonusFreeSpin = 0;
    bonusTotalWin = 0;
    bonusModifier = null;
    bonusEnhancerMults = [2, 2, 2, 2, 2];

    // Обновляем модальное окно
    const bonusTitle = document.getElementById('bonusTitle');
    const bonusDescription = document.getElementById('bonusDescription');
    
    if (bonusTitle) bonusTitle.textContent = `${bonusScatterCount} скаттера!`;
    if (bonusDescription) bonusDescription.textContent = `Вы выиграли ${bonusSpinsTotal} фри спинов!`;

    // Показываем модаль
    const bonusModal = document.getElementById('bonusModal');
    if (bonusModal) bonusModal.style.display = 'flex';

    // Установаем обработчик кнопки "Продолжить"
    const continueBtn = document.getElementById('bonusContinueBtn');
    if (continueBtn) {
        continueBtn.onclick = startBonusFreeSpin;
    }

    // Расширяем барабаны (показываем нижние окошечки)
    const enhancersContainer = document.getElementById('enhancers');
    if (enhancersContainer) enhancersContainer.style.display = 'flex';

    const enhancerReels = getBonusEnhancerReels();
    for (const r of enhancerReels) {
        const enhancer = document.getElementById(`enhancer${r}`);
        if (enhancer) {
            enhancer.classList.add('active');
            const eContent = enhancer.querySelector('.enhancer-content');
            if (eContent) eContent.innerHTML = '<div class="symbol"><img src="images/wild.png" alt="wild"></div>';
        }
    }
}

async function startBonusFreeSpin() {
    if (bonusFreeSpin >= bonusSpinsTotal) {
        endBonus();
        return;
    }

    // Скрываем модаль (если она еще видна)
    const bonusModal = document.getElementById('bonusModal');
    if (bonusModal) bonusModal.style.display = 'none';

    // Показываем HUD
    const bonusHud = document.getElementById('bonusHud');
    if (bonusHud) bonusHud.style.display = 'flex';

    // Увеличиваем счетчик фри спинов
    bonusFreeSpin++;

    // Обновляем отображение
    updateBonusHud();
    // Запускаем looping бонусную музыку по типу (3/4/5 скаттера)
    playBonusForCount(bonusScatterCount);
    
    // Сбрасываем линии перед спином
    setLinesCounter(243);
    
    window.currentBonusSpinData = null;

    // Скрываем обычные кнопки
    const spinBtn = document.getElementById('spinBtn');
    const modBtn = document.getElementById('modBtn');
    const skipBtn = document.getElementById('skipBtn');
    
    if (spinBtn) spinBtn.classList.add('spin-hidden');
    if (modBtn) modBtn.classList.add('spin-hidden');
    if (skipBtn) skipBtn.classList.add('spin-hidden');

    // Очищаем старые подсветки барабанов
    document.querySelectorAll('.specchain-reel-highlight').forEach(el => el.classList.remove('specchain-reel-highlight'));
    document.querySelectorAll('.wild-reel-highlight').forEach(el => el.classList.remove('wild-reel-highlight'));
    document.querySelectorAll('.mashup-reel-highlight').forEach(el => el.classList.remove('mashup-reel-highlight'));
    
    bonusHighlightedReels = []; // сбрасываем

    // Спин фри: из книги (если есть запись серии) или полный RNG как в слоте
    const baseBet = currentBaseBet;

    isSpinning = true;

    const presetBonusSpin =
        Array.isArray(bonusPlaybackSpinsRef) && bonusPlaybackSpinsRef.length >= bonusFreeSpin
            ? bonusPlaybackSpinsRef[bonusFreeSpin - 1]
            : null;

    bonusModifier = null;

    let finalResult;
    let afterTwoScatter;

    if (presetBonusSpin) {
        finalResult = spinPresetToLandingResultIndices(presetBonusSpin);

        await spinReels(finalResult, null);

        hideSkipButton();
        scatterGlowArmed = false;
        scatterGlowActive = false;
        scatterGlowSecondScatterReel = -1;
        clearScatterGlow();
        clearReelSlowGlow();

        const hadSplitsPb = await resolveSplitsAndUpdateBoardAnimated();
        if (hadSplitsPb) {
            await sleep(500);
        }

        const resolvedPb = await resolveXWaysAndUpdateBoardAnimated(presetBonusSpin);
        if (resolvedPb.hadXWays) {
            await sleep(500);
        }

        applySpinPresetToState(presetBonusSpin);
        refreshVisibleReelsDomFromBoard();
        updateLastSeedHud(presetBonusSpin, { label: `фри ${bonusFreeSpin}/${bonusSpinsTotal}` });

        afterTwoScatter = {
            ...(gridsFromBoard()),
            xWaysReplacementSymbol: resolvedPb.xWaysReplacementSymbol ?? null
        };
    } else {
        finalResult = generateResult(0);

        if (bonusModifier === 'specchain') {
            const count = 2 + Math.floor(Math.random() * 4);
            const maxStart = 5 - count;
            const start = Math.floor(Math.random() * (maxStart + 1));
            bonusHighlightedReels = Array.from({length: count}, (_, i) => start + i);
        } else if (bonusModifier === 'wild_dansa') {
            const count = 1 + Math.floor(Math.random() * 3);
            bonusHighlightedReels = [1, 2, 3].sort(() => 0.5 - Math.random()).slice(0, count);
        } else if (bonusModifier === 'mashup') {
            bonusHighlightedReels = [0, 1, 2, 3, 4];
        }

        if (bonusModifier) {
            const highlightClass = bonusModifier === 'wild_dansa' ? 'wild-reel-highlight' : `${bonusModifier}-reel-highlight`;
            for (const r of bonusHighlightedReels) {
                const reel = document.getElementById(`reel${r}`);
                if (reel) reel.classList.add(highlightClass);
            }

            showBonusModifierDisplay(bonusModifier);
            await sleep(250);
        }

        if (bonusModifier === 'specchain' && bonusHighlightedReels.length > 0) {
            const sourceReel = bonusHighlightedReels[0];
            for (let i = 1; i < bonusHighlightedReels.length; i++) {
                const r = bonusHighlightedReels[i];
                for (let row = 0; row < 2; row++) {
                    finalResult[r][row] = finalResult[sourceReel][row];
                }
            }
        }

        await spinReels(finalResult);

        hideSkipButton();
        scatterGlowArmed = false;
        scatterGlowActive = false;
        scatterGlowSecondScatterReel = -1;
        clearScatterGlow();
        clearReelSlowGlow();

        const hadSplits = await resolveSplitsAndUpdateBoardAnimated();
        if (hadSplits) {
            await sleep(500);
        }

        const resolved = await resolveXWaysAndUpdateBoardAnimated();
        if (resolved.hadXWays) {
            await sleep(500);
        }

        afterTwoScatter = await maybeResolveExactlyTwoScatters(
            resolved.namesGrid,
            resolved.weightsGrid,
            resolved.xWaysReplacementSymbol
        );

    }

    // Обновляем счётчик линий с учётом всех множителей
    setLinesCounter(calculateTotalLinesFromWeights(afterTwoScatter.weightsGrid));

    // Вычисляем выигрыш
    let winAmount = 0;
    let winInfo = checkWin(baseBet, afterTwoScatter.namesGrid, afterTwoScatter.weightsGrid);
    winAmount = winInfo.totalWin;
    
    bonusTotalWin += winAmount;
    updateBonusHud();

    // Показываем выигрыш
    let waitWinCountEnd = Promise.resolve();
    if (winAmount > 0) {
        waitWinCountEnd = showWinPresentation(winInfo);
    }
    await waitWinCountEnd;

    const capMoney = getMaxWinCapMoney(baseBet);
    if (bonusTotalWin >= capMoney - 1e-6) {
        isSpinning = false;
        await runMaxWinBustedFlow(baseBet);
        return;
    }

    // Апгрейд scatter (+спины / окошки): только для RNG-бонуса; из книги серия фиксированной длины
    let upgradedScatterThisSpin = 0;

    if (!bonusPlaybackSpinsRef && isBonusGame) {
        if (bonusScatterCount === 3) {
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (afterTwoScatter.namesGrid[4][row] === 'scatter') {
                    upgradedScatterThisSpin = 1;
                    break;
                }
            }
        } else if (bonusScatterCount === 4) {
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (afterTwoScatter.namesGrid[0][row] === 'scatter') {
                    upgradedScatterThisSpin = 2;
                    break;
                }
            }
        }
    }

    if (upgradedScatterThisSpin === 1) {
        // +1 фри спин (3 -> 4 скаттера)
        bonusSpinsTotal += 1;
        updateBonusHud();
        bonusScatterCount = 4;
        playBonusForCount(4);
        
        // Активируем окно на 5-м барабане (индекс 4)
        const enhancer = document.getElementById(`enhancer4`);
        if (enhancer && !enhancer.classList.contains('active')) {
            enhancer.classList.add('active');
            const eContent = enhancer.querySelector('.enhancer-content');
            if (eContent) eContent.innerHTML = '<div class="symbol"><img src="images/wild.png" alt="wild"></div>';
        }
        await sleep(500); // Небольшая пауза для эффекта
    } else if (upgradedScatterThisSpin === 2) {
        // +2 фри спина (4 -> 5 скаттеров)
        bonusSpinsTotal += 2;
        updateBonusHud();
        
        // Показываем окно "5 скаттеров"
        const bonusTitle = document.getElementById('bonusTitle');
        const bonusDescription = document.getElementById('bonusDescription');
        
        if (bonusTitle) bonusTitle.textContent = `5 скаттеров!`;
        if (bonusDescription) bonusDescription.textContent = `Осталось ${bonusSpinsTotal - bonusFreeSpin} фри спинов!`;

        const bonusModal = document.getElementById('bonusModal');
        if (bonusModal) {
            bonusModal.style.display = 'flex';
            
            // Ждем клика по кнопке продолжить
            await new Promise(resolve => {
                const continueBtn = document.getElementById('bonusContinueBtn');
                if (continueBtn) {
                    continueBtn.onclick = () => {
                        bonusModal.style.display = 'none';
                        continueBtn.onclick = startBonusFreeSpin; // Возвращаем оригинальный обработчик
                        resolve();
                    };
                } else {
                    setTimeout(() => {
                        bonusModal.style.display = 'none';
                        resolve();
                    }, 2000);
                }
            });
        }
        
        bonusScatterCount = 5;
        playBonusForCount(5);
        
        // Активируем окно на 1-м барабане (индекс 0)
        const enhancer = document.getElementById(`enhancer0`);
        if (enhancer && !enhancer.classList.contains('active')) {
            enhancer.classList.add('active');
            const eContent = enhancer.querySelector('.enhancer-content');
            if (eContent) eContent.innerHTML = '<div class="symbol"><img src="images/wild.png" alt="wild"></div>';
        }
        await sleep(500);
    }

    // Сброс модификатора после спина
    bonusModifier = null;

    // Переход к следующему фри спину или завершение
    isSpinning = false;
    if (bonusFreeSpin >= bonusSpinsTotal) {
        await sleep(1500);
        endBonus();
    } else {
        // Автоматически запускаем следующий спин через большую паузу
        setTimeout(startBonusFreeSpin, 2000);
    }
}

function updateBonusHud() {
    const spinsLeftEl = document.getElementById('bonusSpinsLeft');
    const totalWinEl = document.getElementById('bonusTotalWin');
    
    if (spinsLeftEl) {
        const remaining = bonusSpinsTotal - bonusFreeSpin;
        spinsLeftEl.textContent = `Фри спинов: ${remaining}`;
    }
    
    if (totalWinEl) {
        totalWinEl.textContent = `Итого выигрыш: ${bonusTotalWin.toFixed(2)}`;
    }
}

function showBonusModifierDisplay(modifier) {
    const display = document.getElementById('bonusModifierDisplay');
    const modName = document.getElementById('modifierName');
    
    if (!display || !modName) return;

    const modText = {
        'specchain': 'SPECCHAIN',
        'wild_dansa': 'WILD DANSA',
        'mashup': 'MASHUP'
    }[modifier] || 'MODIFIER';

    modName.textContent = modText;
    modName.className = `modifier-name ${modifier}`;
    display.style.display = 'flex';

    setTimeout(() => {
        display.style.display = 'none';
    }, 1500);
}

function applyMashupModifier(namesGrid) {
    // Преобразуем все high символы в high5
    for (const reel of bonusHighlightedReels) {
        const rowsCount = namesGrid[reel].length;
        for (let row = 0; row < rowsCount; row++) {
            const cell = namesGrid[reel][row];
            if (cell && cell.match(/^high[1-5]$/)) {
                namesGrid[reel][row] = 'high5';
                
                // Обновляем визуальное отображение на доске
                const symbolEl = getVisibleSymbolElement(reel, row);
                if (symbolEl) {
                    const img = symbolEl.querySelector('img');
                    if (img) {
                        img.src = `images/high5.png`;
                        img.alt = 'high5';
                    }
                    symbolEl.classList.add('mashup-highlight');
                }

                // Нижний ряд в бонусе — отдельное окошко enhancer
                if (row === 2) {
                    const enhancer = document.getElementById(`enhancer${reel}`);
                    if (enhancer && enhancer.classList.contains('active')) {
                        const enhContent = enhancer.querySelector('.enhancer-content');
                        const wrap = enhContent?.querySelector('.symbol');
                        const img = wrap?.querySelector('img');
                        if (img) {
                            img.src = 'images/high5.png';
                            img.alt = 'high5';
                        }
                        if (wrap) wrap.classList.add('mashup-highlight');
                    }
                }
                
                // Также не забываем обновить currentBoard
                currentBoard[reel][row] = 'high5';
            }
        }
    }
}

// Та же схема, что resolveXWaysAndUpdateBoardAnimated: пауза 0.5с + мерцание low ↔ wild → финальный wild (без бейджа множителя)
async function applyWildDansaModifier(namesGrid) {
    // wild_dansa: Превращает все low символы в wild на 1-3 случайных средних барабанах
    // Работает только на верхние и средние символы (индексы 0 и 1), игнорируя нижние (2)
    const allLow = [];
    for (const reel of bonusHighlightedReels) {
        for (let row = 0; row < 2; row++) {
            const cell = namesGrid[reel][row];
            if (cell && cell.match(/^low[1-5]$/)) {
                const symbolEl = getVisibleSymbolElement(reel, row);
                const img = symbolEl?.querySelector('img');
                allLow.push({ reel, row, from: cell, el: symbolEl, img });
            }
        }
    }
    if (allLow.length === 0) return;

    const flickerTargets = allLow.filter((p) => p.img && p.el);

    await sleep(500);

    const flickerDuration = 420;
    const flickerStep = 70;
    const steps = Math.max(1, Math.floor(flickerDuration / flickerStep));
    let showReplacement = false;
    for (let i = 0; i < steps; i++) {
        showReplacement = !showReplacement;
        for (const t of flickerTargets) {
            t.img.src = showReplacement ? 'images/wild.png' : `images/${t.from}.png`;
            t.img.alt = showReplacement ? 'wild' : t.from;
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(flickerStep);
    }

    for (const p of allLow) {
        namesGrid[p.reel][p.row] = 'wild';
        currentBoard[p.reel][p.row] = 'wild';
        if (p.img && p.el) {
            p.img.src = 'images/wild.png';
            p.img.alt = 'wild';
            p.el.classList.add('wild-highlight');
        }
    }
}

function applySpecchainModifier(namesGrid) {
    // specchain: Мы уже синхронизировали символы в finalResult для ячеек 0 и 1 до спина.
    // Здесь только добавляем красивую подсветку (.specchain-highlight) на измененные ячейки.
    for (const reel of bonusHighlightedReels) {
        // Подсвечиваем только верхнюю и среднюю позицию (индексы 0 и 1)
        for (let row = 0; row < 2; row++) {
            const symbolEl = getVisibleSymbolElement(reel, row);
            if (symbolEl) {
                symbolEl.classList.add('specchain-highlight');
            }
        }
    }
}

function endBonus() {
    if (buyJackpotPending) {
        buyJackpotPending = false;
        isSpinning = false;
        void runMaxWinBustedFlow(currentBaseBet);
        return;
    }

    stopBonusAndResumeBg();
    isBonusGame = false;

    const bonusHud = document.getElementById('bonusHud');
    const bonusModal = document.getElementById('bonusModal');
    
    if (bonusHud) bonusHud.style.display = 'none';
    if (bonusModal) {
        bonusModal.style.display = 'flex';
        const title = document.getElementById('bonusTitle');
        const desc = document.getElementById('bonusDescription');
        const btn = document.getElementById('bonusContinueBtn');
        
        if (title) title.textContent = 'Бонус завершен!';
        if (desc) desc.textContent = `Вы выиграли: ${bonusTotalWin.toFixed(2)}`;
        if (btn) {
            btn.textContent = 'Вернуться';
            btn.onclick = exitBonus;
        }
    }
}

async function exitBonus() {
    const bonusModal = document.getElementById('bonusModal');
    if (bonusModal) bonusModal.style.display = 'none';
    await finalizeBonusSession(getCappedBonusPayout(currentBaseBet));
}

async function finalizeBonusSession(payout) {
    bonusPlaybackSpinsRef = null;

    const pay = Math.max(0, Number(payout) || 0);

    if (casinoApiAvailable) {
        if (pay > 0) {
            try {
                await settleCasinoSpin(0, pay);
            } catch (err) {
                console.error('[CASINO] Ошибка зачисления выигрыша с бонуса:', err);
            }
        }
    } else {
        balance += pay;
        updateBalance();
    }

    stopBonusAndResumeBg();

    const bonusHud = document.getElementById('bonusHud');
    if (bonusHud) bonusHud.style.display = 'none';

    const enhancersContainer = document.getElementById('enhancers');
    if (enhancersContainer) enhancersContainer.style.display = 'none';

    for (let r = 0; r < NUM_REELS; r++) {
        const enhancer = document.getElementById(`enhancer${r}`);
        if (enhancer) enhancer.classList.remove('active');
    }

    const spinBtn = document.getElementById('spinBtn');
    const modBtn = document.getElementById('modBtn');
    const skipBtn = document.getElementById('skipBtn');

    if (spinBtn) spinBtn.classList.remove('spin-hidden');
    if (modBtn) modBtn.classList.remove('spin-hidden');
    if (skipBtn) skipBtn.classList.add('spin-hidden');

    bonusFreeSpin = 0;
    bonusSpinsTotal = 0;
    bonusTotalWin = 0;
    bonusModifier = null;
    bonusScatterCount = 0;
    isBonusGame = false;
    isSpinning = false;
    buyJackpotPending = false;
}

// Проверка выигрыша (243 способа выиграть)
// Правило: выплата = (стоимость_символа по таблице) × (количество путей для максимальной комбинации)
// Количество путей = произведение количества появлений символа на каждом барабане
function checkWin(bet, finalResultOrNamesGrid, weightsGrid = null) {
    let totalWin = 0;
    let totalWays = 0;
    const highlights = [];

    // Нормализуем вход: либо индексы, либо готовая сетка названий
    const result = weightsGrid
        ? finalResultOrNamesGrid
        : finalResultOrNamesGrid.map(reel => reel.map(idx => SYMBOLS[idx]));

    const weights = weightsGrid
        ? weightsGrid
        : Array.from({ length: NUM_REELS }, () => Array.from({ length: VISIBLE_ROWS }, () => 1));

    // Считаем только оплачиваемые символы (xWays сам по себе не платит)
    const payableSymbols = Object.keys(PAYOUTS);
    
    for (const targetSymbol of payableSymbols) {
        // Считаем на скольких позициях символ появляется на каждом барабане
        const symbolCounts = [];
        
        for (let reel = 0; reel < NUM_REELS; reel++) {
            let count = 0;
            const maxRow = result[reel].length;
            for (let row = 0; row < maxRow; row++) {
                const cell = result[reel][row];
                if (cell === targetSymbol || cell === 'wild' || cell === 'split_wilds') {
                    count += (weights?.[reel]?.[row] || 1);
                }
            }
            symbolCounts.push(count);
        }
        
        // Находим максимальную длину последовательности слева направо
        let maxLength = 0;
        for (let len = NUM_REELS; len >= 3; len--) {
            let hasSequence = true;
            for (let i = 0; i < len; i++) {
                if (symbolCounts[i] === 0) {
                    hasSequence = false;
                    break;
                }
            }
            if (hasSequence) {
                maxLength = len;
                break;
            }
        }
        
        // Если есть выигрышная комбинация (минимум 3 барабана)
        if (maxLength >= 3) {
            // Количество путей = произведение количеств на каждом барабане
            let ways = 1;
            for (let i = 0; i < maxLength; i++) {
                ways *= symbolCounts[i];
            }
            
            const multiplier = PAYOUTS[targetSymbol]?.[maxLength];
            if (!multiplier) continue;
            const win = bet * multiplier * ways;
            
            console.log(`${targetSymbol} x${maxLength}: [${symbolCounts.slice(0, maxLength).join('×')}] = ${ways} путей, ${multiplier}x по таблице, итого: ${(multiplier * ways).toFixed(2)}x = ${win.toFixed(2)}`);
            totalWin += win;
            totalWays += ways;

            // Подсветка: все вхождения выигрышного символа на первых N барабанах
            for (let reel = 0; reel < maxLength; reel++) {
                const maxRow = result[reel].length;
                for (let row = 0; row < maxRow; row++) {
                    const cell = result[reel][row];
                    if (cell === targetSymbol || cell === 'wild' || cell === 'split_wilds') {
                        highlights.push({ reel, row });
                    }
                }
            }
        }
    }

    // Дедупликация подсветок
    const uniq = new Set();
    const dedupedHighlights = [];
    for (const h of highlights) {
        const key = `${h.reel}:${h.row}`;
        if (uniq.has(key)) continue;
        uniq.add(key);
        dedupedHighlights.push(h);
    }

    return {
        totalWin,
        totalWays,
        highlights: dedupedHighlights
    };
}

// Получение результата спина
function getSpinResult() {
    const result = [];
    
    for (let reelIndex = 0; reelIndex < NUM_REELS; reelIndex++) {
        const reel = document.getElementById(`reel${reelIndex}`);
        const reelContent = reel.querySelector('.reel-content');
        const symbols = reelContent.querySelectorAll('.symbol');
        
        // Используем сохраненную позицию
        const position = reelPositions[reelIndex];
        
        console.log(`Барабан ${reelIndex}: позиция=${position}, всего символов=${symbols.length}, transform=${reelContent.style.transform}`);
        
        // Получаем три видимых символа
        const reelSymbols = [];
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const symbolIndex = (position + row) % SYMBOLS.length;
            reelSymbols.push(SYMBOLS[symbolIndex]);
        }
        
        result.push(reelSymbols);
    }

    return result;
}

// Получение позиций для линии (243 линии)
function getLinePositions(lineIndex) {
    // 243 = 3^5, каждое число от 0 до 242 можно представить в троичной системе
    // Это дает нам все комбинации позиций (0,1,2) для каждого из 5 барабанов
    const positions = [];
    let line = lineIndex;

    for (let reel = 0; reel < NUM_REELS; reel++) {
        positions.push(line % 3);
        line = Math.floor(line / 3);
    }

    return positions;
}

// Проверка одной линии
function checkLine(result, positions) {
    const symbols = [];
    
    for (let reel = 0; reel < NUM_REELS; reel++) {
        const row = positions[reel];
        symbols.push(result[reel][row]);
    }

    // Проверяем совпадения слева направо
    // Ищем наибольшую последовательность совпадающих символов
    let maxCount = 1;
    let winSymbol = symbols[0];

    for (let i = 1; i < NUM_REELS; i++) {
        if (symbols[i] === symbols[i - 1]) {
            maxCount++;
        } else {
            break;
        }
    }

    return {
        symbol: winSymbol,
        count: maxCount
    };
}

// Обновление баланса
function updateBalance() {
    document.getElementById('balance').textContent = balance.toFixed(2);
}

// Отображение выигрыша
function displayWin(amount) {
    const winElement = document.getElementById('winAmount');
    const winHud = document.getElementById('winHud');
    
    if (amount > 0) {
        if (winHud) {
            winHud.classList.remove('fade-out');
            winHud.style.display = 'flex';
        }
        winElement.textContent = amount.toFixed(2);
        winElement.style.color = '#ffc14a';
        
        // Анимация мигания
        winElement.style.animation = 'none';
        setTimeout(() => {
            winElement.style.animation = 'winFlash 0.6s ease-in-out 3';
        }, 10);
    } else {
        winElement.textContent = '0.00';
        winElement.style.color = '#3ee8a8';
        if (winHud) winHud.style.display = 'none';
    }
}

// Добавляем CSS анимацию для выигрыша
const style = document.createElement('style');
style.textContent = `
    @keyframes winFlash {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(1.2);
        }
    }
`;
document.head.appendChild(style);
