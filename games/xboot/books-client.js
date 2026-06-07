/**
 * BOOKS_XBOOT — клиент к xboot-books-server (V2 бинарник + buy TXT).
 */
(function (global) {
  const BASE_REEL_ROWS = [2, 3, 4, 4, 3, 2];
  const NUM_REELS = 6;
  const BOOK_BONUS_FREE_SPINS = 7;
  const API_BASE = '/xboot-books-api';

  const baseStore = {
    ready: false,
    bookCount: 0,
    queuedEntry: null,
    jackpotSeed: '',
    jackpotBookId: 0,
    meta: { rtp: null, hitRate: null, bonusRate: null }
  };

  const buy3Store = { ready: false, bookCount: 0, meta: {} };
  const buy4Store = { ready: false, bookCount: 0, meta: {} };

  async function apiFetch(path) {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function normalizeEntry(raw) {
    if (!raw?.spin) return null;
    const entry = { ...raw };
    const spin = entry.spin;
    for (let r = 0; r < NUM_REELS; r++) {
      if (!spin[`reel${r}`] && spin.reelIndices?.[r]) {
        spin[`reel${r}`] = spin.reelIndices[r];
      }
    }
    if (entry.bonusSpins) {
      entry.bonusSpins = entry.bonusSpins.map((bs) => {
        const s = { ...bs };
        for (let r = 0; r < NUM_REELS; r++) {
          if (!s[`reel${r}`] && s.reelIndices?.[r]) s[`reel${r}`] = s.reelIndices[r];
        }
        return s;
      });
    }
    return entry;
  }

  /**
   * Health-check сервера книг (без bulk load).
   */
  async function load(_fileName, _scatterIx, onProgress) {
    baseStore.ready = false;
    buy3Store.ready = false;
    buy4Store.ready = false;
    onProgress?.(0);

    try {
      const health = await apiFetch('/api/health');
      onProgress?.(0.5);

      const v2 = health.v2 || {};
      baseStore.ready = !!v2.ready;
      baseStore.bookCount = v2.totalBooks || 0;
      baseStore.jackpotSeed = v2.jackpotSeed || '';
      baseStore.jackpotBookId = v2.jackpotBookId || 0;
      baseStore.meta = {
        rtp: v2.rtp ?? null,
        hitRate: v2.hitRate ?? null,
        bonusRate: v2.bonusRate ?? null,
        jackpotSeed: baseStore.jackpotSeed,
        format: health.format || 'BOOKS_XBOOT_V2'
      };

      buy3Store.ready = !!health.buy3?.ready;
      buy3Store.bookCount = health.buy3?.count || 0;
      buy4Store.ready = !!health.buy4?.ready;
      buy4Store.bookCount = health.buy4?.count || 0;

      onProgress?.(1);
      return baseStore.ready;
    } catch {
      onProgress?.(1);
      return false;
    }
  }

  async function pickRandom(filterFn, scatterGuarantee = 0) {
    if (!baseStore.ready && scatterGuarantee !== 3 && scatterGuarantee !== 4) return null;
    const scatter = scatterGuarantee === 3 || scatterGuarantee === 4 ? scatterGuarantee : 0;
    const maxTries = filterFn ? 24 : 1;

    for (let t = 0; t < maxTries; t++) {
      try {
        const data = await apiFetch(`/api/book/random?scatter=${scatter}`);
        const entry = normalizeEntry(data.entry);
        if (!entry) continue;
        if (!filterFn || filterFn(entry)) return entry;
      } catch {
        return null;
      }
    }
    return null;
  }

  async function getBySeed(seed, scatterGuarantee = 0) {
    const raw = encodeURIComponent(String(seed).trim());
    const scatter = scatterGuarantee === 3 || scatterGuarantee === 4 ? scatterGuarantee : 0;
    try {
      const data = await apiFetch(`/api/book/seed/${raw}?scatter=${scatter}`);
      return normalizeEntry(data.entry);
    } catch {
      return null;
    }
  }

  async function getByIndex(index, scatterGuarantee = 0) {
    const scatter = scatterGuarantee === 3 || scatterGuarantee === 4 ? scatterGuarantee : 0;
    try {
      const data = await apiFetch(`/api/book/index/${Number(index)}?scatter=${scatter}`);
      return normalizeEntry(data.entry);
    } catch {
      return null;
    }
  }

  async function queueSeed(seedOrIndex) {
    const raw = String(seedOrIndex ?? '').trim();
    if (!raw) return false;

    let entry = null;
    if (/^\d+$/.test(raw)) {
      entry = await getByIndex(Number(raw), 0);
    } else {
      entry = await getBySeed(raw, 0);
    }
    if (!entry) return false;
    baseStore.queuedEntry = entry;
    return true;
  }

  function consumeQueued() {
    const entry = baseStore.queuedEntry || null;
    baseStore.queuedEntry = null;
    return entry;
  }

  function getStore() {
    return {
      ready: baseStore.ready,
      bookCount: baseStore.bookCount,
      queuedSeed: baseStore.queuedEntry?.seed || '',
      jackpotSeed: baseStore.jackpotSeed,
      jackpotBookId: baseStore.jackpotBookId,
      meta: baseStore.meta,
      api: true,
      buy3: {
        ready: buy3Store.ready,
        bookCount: buy3Store.bookCount,
        meta: buy3Store.meta
      },
      buy4: {
        ready: buy4Store.ready,
        bookCount: buy4Store.bookCount,
        meta: buy4Store.meta
      }
    };
  }

  function spinPresetToBoard(spin, reelRows, symbols) {
    const board = [];
    const mults = [];
    for (let r = 0; r < NUM_REELS; r++) {
      const rows = reelRows[r];
      board[r] = [];
      mults[r] = [];
      for (let row = 0; row < rows; row++) {
        const ix = spin[`reel${r}`][row];
        board[r][row] = symbols[ix] || symbols[0] || 'low1';
        mults[r][row] = Number(spin.weights[r][row]) || 1;
      }
    }
    const reelNudgeMult = (spin.reelNudgeMult || [1, 1, 1, 1, 1, 1]).map((n) =>
      Math.max(1, Number(n) || 1)
    );
    return { board, mults, reelNudgeMult };
  }

  global.XbootBooks = {
    BASE_REEL_ROWS,
    NUM_REELS,
    BOOK_BONUS_FREE_SPINS,
    API_BASE,
    getStore,
    load,
    pickRandom,
    getBySeed,
    getByIndex,
    queueSeed,
    consumeQueued,
    spinPresetToBoard
  };
})(typeof window !== 'undefined' ? window : globalThis);

