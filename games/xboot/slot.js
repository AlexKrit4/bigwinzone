/**
 * Red Devil — Das xBoot-style slot (6 reels 2-3-4-4-3-2).
 * xWays (барабаны 2 и 5) раскрывает символ x2–x6; xNudge (3–4) — стопка снизу вверх.
 */
(function () {
  const BASE_REEL_ROWS = [2, 3, 4, 4, 3, 2];
  let activeReelRows = BASE_REEL_ROWS.slice();
  const NUM_REELS = 6;

  const SYMBOLS = [
    'low1', 'low2', 'low3', 'low4', 'low5',
    'high1', 'high2', 'high3', 'high4', 'high5',
    'scatter', 'xWays', 'xNudge', 'wild', 'target',
    'wild4', 'xways4', 'xwild4'
  ];

  const PAYOUTS = {
    high1: { 3: 0.88, 4: 3, 5: 6, 6: 20 },
    high2: { 3: 0.4, 4: 0.6, 5: 3.2, 6: 10 },
    high3: { 3: 0.32, 4: 0.52, 5: 1.6, 6: 4.8 },
    high4: { 3: 0.28, 4: 0.48, 5: 1.2, 6: 4 },
    high5: { 3: 0.28, 4: 0.4, 5: 0.88, 6: 3.2 },
    low1: { 3: 0.24, 4: 0.36, 5: 0.8, 6: 2.8 },
    low2: { 3: 0.24, 4: 0.36, 5: 0.72, 6: 2.8 },
    low3: { 3: 0.2, 4: 0.32, 5: 0.68, 6: 2 },
    low4: { 3: 0.2, 4: 0.28, 5: 0.6, 6: 2 },
    low5: { 3: 0.2, 4: 0.24, 5: 0.52, 6: 1.4 }
  };

  const PAYABLE = Object.keys(PAYOUTS);
  const BET_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 25];
  const XWAYS_REDUCTION = 12;
  const XNUDGE_REDUCTION = 14;
  const SCATTER_WEIGHT = 0.22;
  /** Скаттер только на барабанах 2–5 (индексы 1–4), макс. 1 на барабан */
  const SCATTER_REELS = [1, 2, 3, 4];
  const SCATTER_REEL_LAND_CHANCE = 0.11;
  /** Суммарная прокрутка tease-барабанов после 2 скаттеров (без stagger 300 ms). */
  const SCATTER_TEASE_TOTAL_MS = 6000;
  /** Барабаны 2 и 5 (индексы 1, 4) — только xWays */
  const XWAYS_REELS = [1, 4];
  /** Барабаны 3 и 4 (индексы 2, 3) — только xNudge-стопка (база) */
  const XNUDGE_REELS = [2, 3];
  /** Бонус 3 скаттера: xNudge только на 4-м барабане (индекс 3). */
  const BONUS3_XNUDGE_REELS = [3];
  /** Бонус 3 скаттера: xWays на 2-м и 5-м (индексы 1, 4). */
  const BONUS3_XWAYS_REELS = [1, 4];
  const XNUDGE_STACK_SIZE = 4;
  const NUDGE_PUSH_WINDUP_MS = 100;
  const NUDGE_PUSH_MS = 340;
  const NUDGE_PUSH_WINDUP_FRAC = 0.12;
  const NUDGE_PUSH_WINDUP_MAX_PX = 12;
  const XNUDGE_LAND_CHANCE = 0.14;
  /** Шанс вставить в ленту прокрутки целый кластер xNudge (4 ряда). */
  const XNUDGE_CLUSTER_STRIP_CHANCE = 0.06;
  const BONUS_EXPAND_REEL = 2;
  const BONUS_EXPAND_ROWS = 8;
  /** Барабаны 4–6 (индексы 3–5): крутятся, пока идёт TARGET */
  const BONUS_TAIL_REELS = [3, 4, 5];
  const TAIL_HOLD_SPIN_SPEED = 1;
  const TAIL_RELEASE_STAGGER_MS = 450;
  const TAIL_RELEASE_SPIN_SYMBOLS = 10;
  const BONUS_SPINS_FOR_3 = 7;
  const BONUS_SPINS_FOR_4 = 7;
  /** Бонус 4 скаттера: торпеда под слотом, барабаны 2–5 (индексы 1–4). */
  const BONUS4_TORPEDO_REELS = [1, 2, 3, 4];
  const BONUS4_XWAYS4_REELS = [1, 4];
  const BONUS4_XWILD4_REELS = [2, 3];
  const BONUS4_BUILDER_LAND_CHANCE = 0.3;
  const BONUS4_SYM_MAX_PX = 182;
  const BONUS4_TORPEDO_GAP_PX = 8;
  const TORPEDO_RISE_MS = 1500;
  const TORPEDO_FALL_MS = 540;
  const TORPEDO_EXIT_MS = 880;
  const TORPEDO_RESOLVE_MS = 520;
  const BUY_SCATTER3_MULT = 75;
  const BUY_SCATTER4_MULT = 350;
  const TARGET_LAND_CHANCE = 0.4;
  const BONUS_TARGET_SPIN_STRIP_LEN = 8;
  const TARGET_TEASE_MS = 4000;
  const BONUS_EXPAND_ANIM_MS = 950;
  const BONUS_SPIN_PAUSE_MS = 700;

  const SPIN_DURATION = 2000;
  const REEL_START_STAGGER_MS = 100;
  const REEL_STOP_STAGGER_MS = 300;
  const REEL_STOP_STAGGER_FAST_MS = 80;
  const REEL_START_STAGGER_FAST_MS = 40;
  const REEL_SPIN_LINEAR_FRAC = 0.86;
  const REEL_SPIN_BASE_LINEAR_MS = 900;
  const REEL_SPIN_BASE_LINEAR_FAST_MS = 520;
  const REEL_DECEL_MS = 120;
  const REEL_DECEL_FAST_MS = 70;
  const SKIP_APPEAR_DELAY_MS = 400;
  const FAST_FORWARD_STAGGER_MS = 50;
  const XBOOT_TURBO_STORAGE_KEY = 'xbootFastReelStop';
  /** Ways-tease: +N ms к таймингу остановки; барабан крутится дальше (без паузы ленты). */
  const WAYS_TEASE_INTER_REEL_MS = 500;
  const WAYS_TEASE_MIN_REELS = 3;
  const NUM_SPINS_PER_REEL = 1;

  const BIG_WIN_MIN_MULT = 15;
  const BIG_WIN_PRELUDE_BAM_MS = 713;
  const BIG_WIN_PRELUDE_SHAKE_MS = 921;
  const BIG_WIN_PRELUDE_SHAKE_MAX_PX = 10;
  const BIG_WIN_PRELUDE_SHAKE_HZ = 39;
  const BIG_WIN_STAGE_MS = 7500;
  /** Пауза на экране после достижения финальной суммы. */
  const BIG_WIN_HOLD_AFTER_FINAL_MS = 1500;
  /** Масштаб счётчика: от 1.0 (старт) до BIG_WIN_COUNTER_SCALE_MAX (финал). */
  const BIG_WIN_COUNTER_SCALE_MAX = 1.72;
  const BIG_WIN_TIER_CAPS = [50, 100, 200, 500];
  const MAX_WIN_CAP_MULT = 55200;
  const MAX_WIN_COUNTER_MS = 7500;
  const SOUND_MAXWIN = 'maxwin.ogg';
  const SOUND_MAXWIN2 = 'maxwin2.ogg';
  const SOUND_BAM = 'Bam.ogg';
  const SOUND_TRRR = 'trrr.ogg';
  const SOUND_WIN = 'win.ogg';
  const SOUND_WIN_OUT = 'win_out.ogg';
  const SOUND_BOOM = 'boom.ogg';
  const SOUND_STOP = 'stop.ogg';
  const SOUND_SPIN = 'spin.ogg';
  const SOUND_SCATTER = 'scatter.ogg';
  const SOUND_SCATTER3 = 'scatter3.ogg';
  const SOUND_SCATTER4 = 'scatter4.ogg';
  const SOUND_PRELUDE = 'prelude.ogg';
  const SOUND_PRELUDE_TARGET = 'prelude_target.ogg';
  const SOUND_TARGET = 'target.ogg';
  const TARGET_RESULT_DELAY_MS = 1000;
  const SOUND_NUDGE = 'nudge.ogg';
  const SOUND_NUDGE_BAM = 'nudge_bam.ogg';
  const SOUND_NUDGE_SWAP = 'nudge_swap.ogg';
  const SOUND_BONUS3 = 'bonus3.ogg';
  const SOUND_BONUS3_LOOP = 'bonus3_2.ogg';
  const SOUND_BONUS3_END = 'endbonus3.ogg';
  const SOUND_BONUS3_END_2 = 'endbonus3_2.ogg';
  const SOUND_BONUS3_END_LOOP = 'endbonus3_3.ogg';
  const BONUS_ENTRY_LOOP_DELAY_MS = 1000;
  const BONUS3_END_TO_END2_MS = 553;
  const BONUS3_END2_TO_LOOP_MS = 300;
  const BONUS3_END_COUNTER_MS = 1000;
  const SOUND_MAIN = 'main.ogg';
  const SOUND_BONUS3_MAIN = 'bonus3_main.ogg';
  const SOUND_BONUS4_MAIN = 'bonus4_main.ogg';
  const SOUND_WIN_DEFAULT = 'win_default.ogg';
  const SOUND_BZZZ = 'bzzz.ogg';
  const SOUND_WAYS = 'ways.ogg';
  const SOUND_XWAYS = 'xWays.ogg';
  const WAYS_HIT_SOUNDS = {
    3: '3.ogg',
    4: '4.ogg',
    5: '5.ogg',
    6: '6.ogg'
  };

  let balance = 1000;
  let bet = 1;
  let isSpinning = false;
  let casinoApiAvailable = true;

  let board = [];
  let mults = [];
  /** Множитель xNudge под барабаном (только reels 3–4), ×1 по умолчанию */
  let reelNudgeMult = [1, 1, 1, 1, 1, 1];

  let bonusMode = false;
  /** 3-й барабан визуально расширен (после анимации входа) */
  let bonusReelExpanded = false;
  let freeSpinsRemaining = 0;
  let bonusTotalWin = 0;
  /** 3 или 4 — как вошли в бонус (для target-tease на 3 скаттерах) */
  let bonusEntryScatterCount = 0;
  /** Торпеда 4-скаттерного бонуса: xways4 | xwild4 | null по слотам 0–3 */
  let torpedoSlots = [null, null, null, null];
  /** Ряд барабана, куда упал билдер торпеды (по слотам 0–3). */
  let torpedoDropRows = [null, null, null, null];
  /** После полной торпеды: финальные символы под слотом для расчёта (не на барабанах). */
  let torpedoResolved = null;
  let torpedoBarShown = false;
  /** TARGET попал — nudge на 3-м барабане рисуем nudge_target.png */
  let bonusTargetNudgeArtReel = false;
  /** 0 | 3 | 4 — модификатор ставки на следующий спин (как в Rave) */
  let pendingScatterGuarantee = 0;

  /** Книги BOOKS_XBOOT_V1 — базовый спин и фри из books-seeds.txt */
  let booksReady = false;
  let bonusPlaybackSpinsRef = null;
  let bonusPlaybackSpinIdx = 0;
  /** Активная книга: выплата = totalWin@1 × ставка (джекпот и др.). */
  let activeBookSession = null;

  let cachedSymbolHeightPx = 0;
  const spinAnimators = new Set();
  let spinAnimRafId = 0;
  /** Турбо: быстрее остановка барабанов (кнопка ⚡). */
  let fastReelStopMode = false;
  let turboReelsToggleBound = false;
  let spinSkipReady = false;
  let spinSkipAppearTimeout = null;
  /** @type {Array<object|null>} */
  let activeReelControllers = [];
  const CASINO_API = {
    async getBalance() {
      const res = await fetch('/api/balance', { credentials: 'include' });
      if (!res.ok) {
        const err = new Error('balance');
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    async settleSpin(betAmt, winAmt, meta = {}) {
      const res = await fetch('/api/spin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bet: betAmt,
          win: winAmt,
          ...meta
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, status: res.status, data };
      }
      return { ok: true, ...data };
    }
  };

  let leaderboardGameFilter = 'game';
  let leaderboardScope = 'personal';
  let replayMode = false;
  /** @type {{ seed?: string, bookIndex?: number|null, bet: number, win: number, mult: number, scatterBuy: number } | null} */
  let replayConfig = null;

  function inferScatterBuyFromSeed(seed) {
    const s = String(seed || '').trim().toLowerCase();
    if (s.startsWith('xbb3_')) return 3;
    if (s.startsWith('xbb4_')) return 4;
    return 0;
  }

  function parseReplayConfig() {
    const qs = new URLSearchParams(location.search);
    if (qs.get('replay') !== '1') return null;
    const seed = (qs.get('seed') || '').trim();
    const indexRaw = qs.get('index');
    const bookIndex = indexRaw != null && indexRaw !== '' ? Number(indexRaw) : null;
    if (!seed && (bookIndex == null || !Number.isFinite(bookIndex))) return null;
    const bet = Math.max(0, Number(qs.get('bet')) || 1);
    const win = Math.max(0, Number(qs.get('win')) || 0);
    const mult = Math.max(0, Number(qs.get('mult')) || 0);
    const scatterRaw = Number(qs.get('scatter') || qs.get('scatterBuy') || 0);
    const scatterBuy =
      scatterRaw === 3 || scatterRaw === 4
        ? scatterRaw
        : inferScatterBuyFromSeed(seed);
    return {
      seed: seed || undefined,
      bookIndex,
      bet,
      win,
      mult: mult || (bet > 0 ? win / bet : 0),
      scatterBuy
    };
  }

  function snapBetToSteps(target) {
    const val = Math.max(0, Number(target) || 0);
    let best = BET_STEPS[0];
    let bestDiff = Math.abs(best - val);
    for (const step of BET_STEPS) {
      const diff = Math.abs(step - val);
      if (diff < bestDiff) {
        best = step;
        bestDiff = diff;
      }
    }
    return best;
  }

  function pauseAllSlotAudio() {
    pauseBgMusic();
    stopBigWinAudio();
    stopBonusEndSounds();
    stopBonusEntryMusic();
    try {
      reelSpinLoopAudio?.pause();
    } catch {
      /* ignore */
    }
    Object.values(slotSoundCache).forEach((audio) => {
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
    });
  }

  function buildReplayUrl(row) {
    const params = new URLSearchParams({
      embed: '1',
      replay: '1',
      bet: String(row.bet),
      win: String(row.win),
      mult: String(row.multiplier),
      scatter: String(row.scatterBuy || inferScatterBuyFromSeed(row.bookSeed))
    });
    if (row.bookSeed) params.set('seed', row.bookSeed);
    else if (row.bookIndex != null) params.set('index', String(row.bookIndex));
    return `${location.origin}/slot/games/xboot/index.html?${params.toString()}`;
  }

  function openReplayTab(row) {
    pauseAllSlotAudio();
    try {
      window.parent?.postMessage({ type: 'XBOOT_PAUSE_AUDIO' }, location.origin);
    } catch {
      /* ignore */
    }
    const url = buildReplayUrl(row);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function applyReplayModeUi() {
    document.body.classList.add('replay-mode');
    const spinBtn = document.getElementById('spinBtn');
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.textContent = 'ПОВТОР';
    }
  }

  function showReplayContinueButton() {
    const btn = document.getElementById('slotLoaderContinue');
    const status = document.getElementById('slotLoaderStatus');
    if (status) status.textContent = 'Повтор готов';
    setSlotLoaderProgress(1);
    if (btn) btn.hidden = false;
  }

  function hideSlotLoaderImmediate() {
    const loader = document.getElementById('slotLoader');
    const btn = document.getElementById('slotLoaderContinue');
    if (btn) btn.hidden = true;
    if (!loader) return;
    loader.classList.add('is-hidden');
    loader.hidden = true;
  }

  async function loadReplayBook() {
    if (!replayConfig) return null;
    const scatter = replayConfig.scatterBuy;
    if (replayConfig.seed) {
      return window.XbootBooks?.getBySeed?.(replayConfig.seed, scatter);
    }
    if (replayConfig.bookIndex != null) {
      return window.XbootBooks?.getByIndex?.(replayConfig.bookIndex, scatter);
    }
    return null;
  }

  function showReplayResultOverlay() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('replayResultOverlay');
      const multEl = document.getElementById('replayResultMult');
      const winEl = document.getElementById('replayResultWin');
      const metaEl = document.getElementById('replayResultMeta');
      const okBtn = document.getElementById('replayResultOk');
      if (!overlay || !okBtn || !replayConfig) {
        resolve();
        return;
      }
      if (multEl) multEl.textContent = formatLeaderboardMult(replayConfig.mult);
      if (winEl) winEl.textContent = formatLeaderboardAmount(replayConfig.win);
      if (metaEl) {
        const scatterNote =
          replayConfig.scatterBuy === 3
            ? ' · покупка 3 scatter'
            : replayConfig.scatterBuy === 4
              ? ' · покупка 4 scatter'
              : '';
        metaEl.textContent = `Ставка: ${formatLeaderboardAmount(replayConfig.bet)}${scatterNote}`;
      }
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      const onOk = () => {
        okBtn.removeEventListener('click', onOk);
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        resolve();
      };
      okBtn.addEventListener('click', onOk);
    });
  }

  async function runReplayBookSpin(presetBook, scatterGuarantee) {
    bonusPlaybackSpinsRef =
      presetBook.hasBonus && presetBook.bonusSpins?.length
        ? presetBook.bonusSpins.slice()
        : null;
    bonusPlaybackSpinIdx = 0;
    beginBookSession(presetBook, scatterGuarantee);

    isSpinning = true;
    syncControlsState();
    clearWinPresentation();
    document.getElementById('winDisplay').textContent = '0.00';

    const applied = applyBookSpinPreset(presetBook.spin, BASE_REEL_ROWS);
    const bookSetup = setupBookSpinFromPreset(applied);
    const raw = bookSetup.raw;
    const b = bookSetup.b;
    const m = bookSetup.m;
    const bookTargetNudge = bookSetup.bookTargetNudge;
    const needsBookNudge = bookSetup.needsBookNudge;

    const waysTease = buildWaysTeasePlan(b);
    const scatterPlan = buildScatterSpinPlan(b, { scatterGuarantee });

    try {
      updateHud('0.00');

      await spinReels(raw, {
        waysInterReelGapMs: mergeInterReelGapMs(
          waysTease.waysInterReelGapMs,
          scatterPlan.scatterInterReelGapMs
        ),
        onReelSettled: (reelIdx) => {
          scatterPlan.onReelSettled(reelIdx, b);
          if (waysTease.hasTease) waysTease.onReelSettled(reelIdx, b);
        }
      });
      syncSpinBoardFromRaw(b, m, raw);
      board = b;
      mults = m;

      if (needsBookNudge || boardHasXNudgeStacks(b)) {
        await runBookNudgeAnimation(b, m, bookTargetNudge);
      }
      if (bookTargetNudge) {
        applyBookNudgeMultsForPayout(bookTargetNudge);
      }

      renderBoard(b, m);

      let winInfo = calculateWaysWin(bet, b, m);
      const scatters = presetBook.scatterCount ?? countScatters(b);
      const bookWin = bookBaseWinAmount(winInfo.totalWin);
      winInfo = { ...winInfo, totalWin: bookWin };

      updateHud(winInfo.totalWin.toFixed(2));

      if (winInfo.totalWin > 0 && !presetBook.hasBonus) {
        await showWinPresentation(winInfo);
      }

      const bonusEntry =
        scatterGuarantee === 3 || scatterGuarantee === 4
          ? scatterGuarantee
          : scatters >= 3
            ? scatters
            : 0;

      if (bonusEntry >= 3 && bonusPlaybackSpinsRef?.length) {
        isSpinning = false;
        syncControlsState();
        await runBonusSession(bonusEntry, b, m);
      }
    } finally {
      waysTease.clear();
      scatterPlan.clear();
      isSpinning = false;
      syncControlsState();
    }
  }

  async function startReplaySession() {
    if (!replayConfig || !booksReady) return;
    hideSlotLoaderImmediate();
    ensureBgMusicStarted();

    bet = snapBetToSteps(replayConfig.bet);
    updateHud('0.00');
    updateBetNote();

    const presetBook = await loadReplayBook();
    if (!presetBook?.spin?.reel0) {
      alert('Книга для повтора не найдена.');
      return;
    }

    await runReplayBookSpin(presetBook, replayConfig.scatterBuy);
    pauseAllSlotAudio();
    await showReplayResultOverlay();
    try {
      window.close();
    } catch {
      /* ignore */
    }
  }

  function bindReplayContinue() {
    const btn = document.getElementById('slotLoaderContinue');
    btn?.addEventListener('click', () => {
      btn.disabled = true;
      void startReplaySession().finally(() => {
        btn.disabled = false;
      });
    });
  }

  function setSlotLoaderProgress(ratio, statusText) {
    const fill = document.getElementById('slotLoaderProgress');
    const status = document.getElementById('slotLoaderStatus');
    const pct = Math.max(0, Math.min(100, Math.round((Number(ratio) || 0) * 100)));
    if (fill) fill.style.width = `${pct}%`;
    if (status && statusText) status.textContent = statusText;
  }

  function hideSlotLoader() {
    const loader = document.getElementById('slotLoader');
    if (!loader) return;
    loader.classList.add('is-hidden');
    setTimeout(() => {
      loader.hidden = true;
    }, 480);
  }

  function notifySlotReady() {
    try {
      window.parent?.postMessage({ type: 'XBOOT_SLOT_READY' }, window.location.origin);
    } catch {
      /* ignore */
    }
  }

  function formatLeaderboardAmount(n) {
    const val = Math.max(0, Number(n) || 0);
    const whole = Math.round(val);
    return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatLeaderboardMult(n) {
    const val = Math.max(0, Number(n) || 0);
    const rounded = val >= 100 ? Math.round(val) : Math.round(val * 100) / 100;
    return `${rounded} x`;
  }

  function getWinSettleMeta() {
    const entry = activeBookSession?.entry;
    const seed = entry?.seed || entry?.spin?.seed || null;
    return {
      game: 'xboot',
      gameTitle: 'Red Devil',
      effectiveBet: bet,
      bookSeed: seed,
      bookIndex:
        entry?.bookId ??
        entry?.index ??
        entry?.spin?.bookId ??
        entry?.spin?.index ??
        null,
      scatterBuy:
        activeBookSession?.scatterBuy ??
        inferScatterBuyFromSeed(seed)
    };
  }

  function trophyClass(rank) {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-n';
  }

  function renderLeaderboardRows(entries) {
    const list = document.getElementById('leaderboardList');
    const emptyEl = document.getElementById('leaderboardEmpty');
    const loginEl = document.getElementById('leaderboardLogin');
    if (!list) return;

    list.replaceChildren();
    if (loginEl) loginEl.hidden = true;

    if (!entries?.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    for (const row of entries) {
      const item = document.createElement('div');
      item.className = 'leaderboard-row';

      const trophy = document.createElement('div');
      trophy.className = `leaderboard-trophy ${trophyClass(row.rank)}`;
      trophy.textContent = String(row.rank);

      const meta = document.createElement('div');
      meta.className = 'leaderboard-meta';
      const date = document.createElement('div');
      date.className = 'leaderboard-date';
      date.textContent = row.date;
      const game = document.createElement('div');
      game.className = 'leaderboard-game';
      game.textContent = row.gameTitle || row.game || 'Red Devil';
      meta.append(date, game);

      const mult = document.createElement('div');
      mult.className = 'leaderboard-mult';
      mult.textContent = formatLeaderboardMult(row.multiplier);

      const win = document.createElement('div');
      win.className = 'leaderboard-win';
      win.textContent = formatLeaderboardAmount(row.win);

      const replay = document.createElement('button');
      replay.type = 'button';
      replay.className = 'leaderboard-replay';
      replay.setAttribute('aria-label', 'Повтор');
      replay.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
      const replayKey = row.bookSeed || (row.bookIndex != null ? String(row.bookIndex) : '');
      if (replayKey) {
        replay.addEventListener('click', () => {
          openReplayTab(row);
        });
      } else {
        replay.disabled = true;
      }

      item.append(trophy, meta, mult, win, replay);
      list.appendChild(item);
    }
  }

  function updateLeaderboardHeading() {
    const title = document.getElementById('leaderboardTitle');
    if (!title) return;
    const personal = leaderboardScope === 'personal';
    const allGames = leaderboardGameFilter === 'all';
    if (personal) {
      title.textContent = allGames ? 'Мои лучшие выигрыши' : 'Мои выигрыши — Red Devil';
    } else {
      title.textContent = allGames ? 'Общий топ выигрышей' : 'Топ выигрышей — Red Devil';
    }
  }

  async function fetchLeaderboardEntries() {
    const params = new URLSearchParams({
      scope: leaderboardScope,
      limit: '10',
      t: Date.now().toString()
    });
    params.set('game', leaderboardGameFilter === 'all' ? 'all' : 'xboot');
    const res = await fetch(`/api/leaderboard?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('leaderboard');
    return res.json();
  }

  async function refreshLeaderboard() {
    const emptyEl = document.getElementById('leaderboardEmpty');
    const loginEl = document.getElementById('leaderboardLogin');
    if (emptyEl) emptyEl.hidden = true;
    if (loginEl) loginEl.hidden = true;
    updateLeaderboardHeading();

    try {
      const data = await fetchLeaderboardEntries();
      if (leaderboardScope === 'personal' && !data.loggedIn) {
        renderLeaderboardRows([]);
        if (loginEl) loginEl.hidden = false;
        return;
      }
      renderLeaderboardRows(data.entries || []);
    } catch {
      renderLeaderboardRows([]);
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Не удалось загрузить таблицу';
      }
    }
  }

  function openLeaderboard() {
    const overlay = document.getElementById('leaderboardOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    void refreshLeaderboard();
  }

  function closeLeaderboard() {
    const overlay = document.getElementById('leaderboardOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  }

  function bindLeaderboardUi() {
    document.getElementById('leaderboardBtn')?.addEventListener('click', () => {
      ensureBgMusicStarted();
      openLeaderboard();
    });
    document.getElementById('leaderboardClose')?.addEventListener('click', closeLeaderboard);
    document.getElementById('leaderboardOverlay')?.addEventListener('click', (e) => {
      if (e.target?.id === 'leaderboardOverlay') closeLeaderboard();
    });

    const setGameFilter = (filter) => {
      leaderboardGameFilter = filter;
      document.getElementById('leaderboardTabGame')?.classList.toggle('is-active', filter === 'game');
      document.getElementById('leaderboardTabAll')?.classList.toggle('is-active', filter === 'all');
      void refreshLeaderboard();
    };

    const setScope = (scope) => {
      leaderboardScope = scope;
      document
        .getElementById('leaderboardScopePersonal')
        ?.classList.toggle('is-active', scope === 'personal');
      document
        .getElementById('leaderboardScopeGlobal')
        ?.classList.toggle('is-active', scope === 'global');
      void refreshLeaderboard();
    };

    document.getElementById('leaderboardTabGame')?.addEventListener('click', () => setGameFilter('game'));
    document.getElementById('leaderboardTabAll')?.addEventListener('click', () => setGameFilter('all'));
    document
      .getElementById('leaderboardScopePersonal')
      ?.addEventListener('click', () => setScope('personal'));
    document
      .getElementById('leaderboardScopeGlobal')
      ?.addEventListener('click', () => setScope('global'));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function getReelStopStaggerMs() {
    return fastReelStopMode ? REEL_STOP_STAGGER_FAST_MS : REEL_STOP_STAGGER_MS;
  }

  function getReelStartStaggerMs() {
    return fastReelStopMode ? REEL_START_STAGGER_FAST_MS : REEL_START_STAGGER_MS;
  }

  function getReelSpinBaseLinearMs() {
    return fastReelStopMode ? REEL_SPIN_BASE_LINEAR_FAST_MS : REEL_SPIN_BASE_LINEAR_MS;
  }

  function getReelDecelMs() {
    return fastReelStopMode ? REEL_DECEL_FAST_MS : REEL_DECEL_MS;
  }

  function syncTurboReelsBtn() {
    const btn = document.getElementById('turboReelsBtn');
    if (!btn) return;
    btn.classList.toggle('active', fastReelStopMode);
    btn.setAttribute('aria-pressed', fastReelStopMode ? 'true' : 'false');
  }

  function initTurboReelsToggle() {
    const btn = document.getElementById('turboReelsBtn');
    if (!btn) return;
    try {
      fastReelStopMode = localStorage.getItem(XBOOT_TURBO_STORAGE_KEY) === '1';
    } catch (_) {
      fastReelStopMode = false;
    }
    syncTurboReelsBtn();
    if (turboReelsToggleBound) return;
    turboReelsToggleBound = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      ensureBgMusicStarted();
      fastReelStopMode = !fastReelStopMode;
      try {
        localStorage.setItem(XBOOT_TURBO_STORAGE_KEY, fastReelStopMode ? '1' : '0');
      } catch (_) {}
      syncTurboReelsBtn();
    });
  }

  function syncSpinSkipUi() {
    const frame = document.querySelector('.reels-frame');
    if (!frame) return;
    frame.classList.toggle('spin-skip-ready', isSpinning && spinSkipReady);
    frame.classList.toggle('spin-skip-armed', isSpinning && !spinSkipReady);
  }

  function beginReelSpinSkip() {
    if (spinSkipAppearTimeout) {
      clearTimeout(spinSkipAppearTimeout);
      spinSkipAppearTimeout = null;
    }
    spinSkipReady = false;
    syncSpinSkipUi();
    spinSkipAppearTimeout = setTimeout(() => {
      spinSkipAppearTimeout = null;
      if (isSpinning) {
        spinSkipReady = true;
        syncSpinSkipUi();
      }
    }, SKIP_APPEAR_DELAY_MS);
  }

  function clearReelSpinSkip() {
    spinSkipReady = false;
    if (spinSkipAppearTimeout) {
      clearTimeout(spinSkipAppearTimeout);
      spinSkipAppearTimeout = null;
    }
    syncSpinSkipUi();
  }

  function requestSpinFastForward() {
    if (!isSpinning || !spinSkipReady) return;

    spinSkipReady = false;
    syncSpinSkipUi();

    let fastDelay = 0;
    const now = performance.now();
    const pending = activeReelControllers
      .filter((c) => c && !c.finished && !c.fast)
      .sort((a, b) => a.reelIndex - b.reelIndex);

    for (const c of pending) {
      if (!c.started) {
        if (c.startTimeoutId) {
          clearTimeout(c.startTimeoutId);
          c.startTimeoutId = null;
        }
        c.startAnimation?.();
      }
      if (!c.started) continue;

      const elapsed = performance.now() - c.startPerf;
      c.offAtFastStart =
        typeof c.readOffset === 'function' ? c.readOffset(elapsed) : c.currentOffset || 0;
      c.fast = true;
      c.fastStart = now + fastDelay;
      fastDelay += FAST_FORWARD_STAGGER_MS;
    }
  }

  async function sleepUnlessSkipped(ms, skipCtrl, flag) {
    const step = 40;
    let left = Math.max(0, Number(ms) || 0);
    while (left > 0) {
      if (skipCtrl?.[flag]) return;
      const chunk = Math.min(step, left);
      await sleep(chunk);
      left -= chunk;
    }
  }

  function createBigWinSkipCtrl() {
    const ctrl = {
      active: false,
      inPrelude: false,
      inStage: false,
      inHold: false,
      preludeSkip: false,
      stageSkip: false,
      holdSkip: false,
      preludeShakeRaf: null,
      onPointerDown: null
    };

    ctrl.resetStageSkip = () => {
      ctrl.stageSkip = false;
    };

    ctrl.handlePointerDown = () => {
      if (!ctrl.active) return;
      if (ctrl.inHold) {
        ctrl.holdSkip = true;
        return;
      }
      if (ctrl.inPrelude) {
        ctrl.preludeSkip = true;
        ctrl._flushPreludeShake?.();
        return;
      }
      if (ctrl.inStage) {
        ctrl.stageSkip = true;
        ctrl._flushStageAnim?.();
      }
    };

    ctrl.begin = () => {
      ctrl.active = true;
      ctrl.preludeSkip = false;
      ctrl.stageSkip = false;
      ctrl.holdSkip = false;
      ctrl.onPointerDown = () => ctrl.handlePointerDown();
      document.addEventListener('pointerdown', ctrl.onPointerDown, true);
      const overlay = document.getElementById('bigWinOverlay');
      if (overlay) overlay.classList.add('big-win-overlay--skippable');
    };

    ctrl.end = () => {
      ctrl.active = false;
      ctrl.inPrelude = false;
      ctrl.inStage = false;
      ctrl.inHold = false;
      if (ctrl.onPointerDown) {
        document.removeEventListener('pointerdown', ctrl.onPointerDown, true);
        ctrl.onPointerDown = null;
      }
      if (ctrl.preludeShakeRaf) {
        cancelAnimationFrame(ctrl.preludeShakeRaf);
        ctrl.preludeShakeRaf = null;
      }
      const overlay = document.getElementById('bigWinOverlay');
      if (overlay) overlay.classList.remove('big-win-overlay--skippable');
    };

    return ctrl;
  }

  function endBigWinSkipCtrl() {
    if (bigWinSkipCtrl) {
      bigWinSkipCtrl.end();
      bigWinSkipCtrl = null;
    }
  }

  function easeOutCubic(t) {
    const x = Math.min(Math.max(Number(t) || 0, 0), 1);
    return 1 - Math.pow(1 - x, 3);
  }

  function easeOutBack(t, overshoot = 1.35) {
    const x = Math.min(Math.max(Number(t) || 0, 0), 1);
    const c1 = overshoot;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  /** Резкая посадка: короткое равномерное торможение без щелчка в конце. */
  function easeOutReelStop(t) {
    return Math.min(Math.max(Number(t) || 0, 0), 1);
  }

  function reelTransformY(el, offsetPx) {
    const y = Math.round(Number(offsetPx) || 0);
    el.style.transform = `translate3d(0, ${-y}px, 0)`;
  }

  function markSlotSpinActive(active) {
    document.documentElement.classList.toggle('slot-spin-active', active);
  }

  function pumpSpinAnimators(timestamp) {
    spinAnimRafId = 0;
    if (spinAnimators.size === 0) {
      markSlotSpinActive(false);
      stopReelSpinSound();
      return;
    }
    const now = timestamp ?? performance.now();
    for (const anim of [...spinAnimators]) {
      if (anim.tick(now)) spinAnimators.delete(anim);
    }
    if (spinAnimators.size > 0) {
      spinAnimRafId = requestAnimationFrame(pumpSpinAnimators);
    } else {
      markSlotSpinActive(false);
      stopReelSpinSound();
    }
  }

  function scheduleSpinAnimator(anim) {
    spinAnimators.add(anim);
    markSlotSpinActive(true);
    if (!spinAnimRafId) {
      spinAnimRafId = requestAnimationFrame(pumpSpinAnimators);
    }
  }

  function forceReflowStrip(el) {
    if (el) el.getBoundingClientRect();
  }

  function setStripCompositing(el, on) {
    if (!el) return;
    el.classList.toggle('strip-compositing', on);
  }

  function refreshSymbolHeightCache() {
    const probe = document.querySelector('.reel-viewport .symbol');
    if (probe) {
      const h = probe.getBoundingClientRect().height;
      if (h > 0) cachedSymbolHeightPx = h;
    }
  }

  function getSymbolHeight() {
    if (cachedSymbolHeightPx > 0) return cachedSymbolHeightPx;
    refreshSymbolHeightCache();
    return cachedSymbolHeightPx > 0 ? cachedSymbolHeightPx : 72;
  }

  function setBonus4UiActive(active) {
    document.querySelector('.game-wrap')?.classList.toggle('bonus4-active', !!active);
  }

  function updateResponsiveSlotSize() {
    const frame = document.querySelector('.reels-frame');
    const grid = document.getElementById('reelsGrid');
    if (!frame || !grid) return;

    const frameRect = frame.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const gap = parseFloat(gridStyle.columnGap || gridStyle.gap) || 6;
    const widthForReels = frameRect.width - gap * (NUM_REELS - 1) - 12;
    const isB4 = isBonus4Mode();
    const isB3Expanded = isBonus3Mode() && bonusReelExpanded;
    const maxRows = isB3Expanded
      ? BONUS_EXPAND_ROWS
      : Math.max(...BASE_REEL_ROWS);
    const nudgeLane = isB4 || isB3Expanded ? 30 : 0;
    const prevSym =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sym-h')) || 72;
    const torpedoReserve = isB4 ? prevSym + BONUS4_TORPEDO_GAP_PX + 10 : 0;
    const heightForReels = frameRect.height - nudgeLane - torpedoReserve - 14;
    const byWidth = widthForReels / NUM_REELS;
    const byHeight = heightForReels / maxRows;
    const SLOT_SYM_MAX_PX = isB4 ? BONUS4_SYM_MAX_PX : 148;
    const SLOT_SYM_MIN_PX = isB4 ? 56 : 48;
    let next = Math.floor(Math.min(byWidth, byHeight, SLOT_SYM_MAX_PX));

    if (Number.isFinite(next) && next > 0) {
      const clamped = Math.max(SLOT_SYM_MIN_PX, next);
      document.documentElement.style.setProperty('--sym-h', `${clamped}px`);
      cachedSymbolHeightPx = 0;
      refreshSymbolHeightCache();
      if (isB4) {
        const symH = getSymbolHeight();
        const refinedH = frameRect.height - nudgeLane - symH - BONUS4_TORPEDO_GAP_PX - 14;
        const refined = Math.floor(
          Math.min(byWidth, refinedH / maxRows, BONUS4_SYM_MAX_PX)
        );
        if (refined > clamped) {
          document.documentElement.style.setProperty('--sym-h', `${refined}px`);
          cachedSymbolHeightPx = 0;
          refreshSymbolHeightCache();
        }
      }
    }
  }

  function calcSpinStripSymbols(durationMs, forced = 0) {
    const forcedN = Number(forced) || 0;
    if (forcedN > 0) return forcedN;
    const base = SYMBOLS.length * NUM_SPINS_PER_REEL;
    return Math.max(4, Math.ceil(base * (durationMs / SPIN_DURATION)));
  }

  function computeReelSpinOffsetPx(startOffset, scrollV, tDecelStart, decelMs, elapsed) {
    const so = Math.max(0, Number(startOffset) || 0);
    const v = Math.max(1e-6, Number(scrollV) || 0);
    const t0 = Math.max(0, Number(tDecelStart) || 0);
    const dm = Math.max(1, Number(decelMs) || 1);
    const t = Math.max(0, Number(elapsed) || 0);

    if (t < t0) return Math.max(0, so - v * t);
    const u = Math.min((t - t0) / dm, 1);
    const offAtDecel = Math.max(0, so - v * t0);
    return offAtDecel * (1 - easeOutReelStop(u));
  }

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function symbolSrc(name) {
    return `images/${name}.png`;
  }

  function getXNudgeArtName(reel = -1) {
    if (bonusTargetNudgeArtReel && bonusMode && reel === BONUS_EXPAND_REEL) {
      return 'nudge_target';
    }
    return 'xNudge';
  }

  function getXNudgeStackSize(reel = -1) {
    if (bonusTargetNudgeArtReel && bonusMode && reel === BONUS_EXPAND_REEL) {
      return BONUS_EXPAND_ROWS;
    }
    return XNUDGE_STACK_SIZE;
  }

  function xNudgeArtUrl(reel = -1) {
    return symbolSrc(getXNudgeArtName(reel));
  }

  function getReelRows(reelIndex) {
    return activeReelRows[reelIndex];
  }

  function getActiveXNudgeReels() {
    if (isBonus4Mode()) return XNUDGE_REELS;
    if (bonusMode && bonusEntryScatterCount === 3) return BONUS3_XNUDGE_REELS;
    if (bonusMode) return [];
    return XNUDGE_REELS;
  }

  function getActiveXWAYSReels() {
    if (isBonus4Mode()) return XWAYS_REELS;
    if (bonusMode && bonusEntryScatterCount === 3) return BONUS3_XWAYS_REELS;
    if (bonusMode) return [];
    return XWAYS_REELS;
  }

  function reelHasXNudgeLane(reelIndex) {
    if (bonusMode && bonusReelExpanded && reelIndex === BONUS_EXPAND_REEL) return true;
    return getActiveXNudgeReels().includes(reelIndex);
  }

  function getSymbolWeight(name, reelIndex = -1, opts = {}) {
    const bonus = !!opts.bonus;
    const omitScatter = !!opts.omitScatter;
    if (name === 'xWays') {
      const xwReels = bonus ? getActiveXWAYSReels() : XWAYS_REELS;
      if (!xwReels.length) return 0;
      return reelIndex >= 0 && xwReels.includes(reelIndex) ? 1 / XWAYS_REDUCTION : 0;
    }
    if (name === 'xNudge' || name === 'wild') return 0;
    if (name === 'target') {
      if (isBonus4Mode()) return 0;
      if (bonus && reelIndex === BONUS_EXPAND_REEL && opts.spinStrip) {
        return (TARGET_LAND_CHANCE / (1 - TARGET_LAND_CHANCE)) * PAYABLE.length;
      }
      return 0;
    }
    if (name === 'scatter') {
      if (bonus || omitScatter) return 0;
      return reelIndex >= 0 && SCATTER_REELS.includes(reelIndex) ? SCATTER_WEIGHT : 0;
    }
    return 1;
  }

  function pickRandomSymbol(reelIndex = -1, opts = {}) {
    const weights = SYMBOLS.map((name) => getSymbolWeight(name, reelIndex, opts));
    const total = weights.reduce((a, b) => a + b, 0);
    if (!(total > 0)) return 'low1';
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return SYMBOLS[i];
    }
    return SYMBOLS[0];
  }

  function generateReelColumn(reelIndex, opts = {}) {
    const rows = getReelRows(reelIndex);
    const col = Array.from({ length: rows }, () =>
      pickRandomSymbol(reelIndex, { ...opts, omitScatter: true })
    );

    if (opts.forceScatter) {
      const row = randomInt(0, rows - 1);
      col[row] = 'scatter';
      return col;
    }

    if (!opts.bonus && SCATTER_REELS.includes(reelIndex) && Math.random() < SCATTER_REEL_LAND_CHANCE) {
      const row = randomInt(0, rows - 1);
      col[row] = 'scatter';
    }

    if (opts.bonus && reelIndex === BONUS_EXPAND_REEL && !isBonus4Mode()) {
      placeAtMostOneBonusTarget(col, rows);
    }

    return col;
  }

  /** На финальном поле — не больше одного target (40% шанс). */
  function placeAtMostOneBonusTarget(col, rows) {
    for (let row = 0; row < rows; row++) {
      if (col[row] === 'target') {
        col[row] = pickRandomSymbol(BONUS_EXPAND_REEL, {
          bonus: true,
          omitScatter: true
        });
      }
    }
    if (Math.random() >= TARGET_LAND_CHANCE) return;
    let targetRow = randomInt(0, rows - 1);
    if (col[targetRow] === 'scatter') {
      targetRow = (targetRow + 1) % rows;
    }
    col[targetRow] = 'target';
  }

  /** 8 символов ленты прокрутки 3-го барабана: ≥1 target, ≤1 target. */
  function buildBonusExpandSpinStripSymbols(stripLen = BONUS_TARGET_SPIN_STRIP_LEN) {
    const len = Math.max(BONUS_TARGET_SPIN_STRIP_LEN, Number(stripLen) || BONUS_TARGET_SPIN_STRIP_LEN);
    const syms = [];
    for (let i = 0; i < len; i++) {
      syms.push(
        pickRandomSymbol(BONUS_EXPAND_REEL, {
          bonus: true,
          omitScatter: true,
          spinStrip: true
        })
      );
    }
    if (!syms.includes('target')) {
      syms[randomInt(0, len - 1)] = 'target';
    }
    let targetUsed = false;
    for (let i = 0; i < len; i++) {
      if (syms[i] !== 'target') continue;
      if (targetUsed) {
        syms[i] = pickRandomSymbol(BONUS_EXPAND_REEL, {
          bonus: true,
          omitScatter: true
        });
      } else {
        targetUsed = true;
      }
    }
    return syms;
  }

  function buildBoardWithScatterCount(scatterCount) {
    const need = scatterCount === 4 ? 4 : 3;
    const b = activeReelRows.map((_, r) =>
      generateReelColumn(r, { bonus: false, omitScatter: true })
    );

    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        if (b[r][row] === 'scatter') {
          b[r][row] = pickRandomSymbol(r, { omitScatter: true });
        }
      }
    }

    const reels =
      need === 4
        ? [...SCATTER_REELS]
        : [...SCATTER_REELS].sort(() => Math.random() - 0.5).slice(0, 3);

    for (const r of reels) {
      const row = randomInt(0, getReelRows(r) - 1);
      b[r][row] = 'scatter';
    }

    return b;
  }

  function initBoard() {
    board = activeReelRows.map((_, r) => generateReelColumn(r, { bonus: bonusMode }));
    mults = activeReelRows.map((rows) => Array.from({ length: rows }, () => 1));
    reelNudgeMult = [1, 1, 1, 1, 1, 1];
  }

  function cellMatches(sym, cell) {
    return (
      cell === sym ||
      cell === 'wild' ||
      cell === 'wild4' ||
      cell === 'xways4' ||
      cell === 'xwild4'
    );
  }

  function isBonus3Mode() {
    return bonusMode && bonusEntryScatterCount === 3;
  }

  function isBonus4Mode() {
    return bonusMode && bonusEntryScatterCount === 4;
  }

  function torpedoSlotForReel(reel) {
    return BONUS4_TORPEDO_REELS.indexOf(reel);
  }

  function torpedoReelBlocked(reel) {
    const slot = torpedoSlotForReel(reel);
    return slot >= 0 && torpedoSlots[slot] != null;
  }

  function torpedoIsFull() {
    return torpedoSlots.every((s) => s != null);
  }

  function expectedTorpedoOverlay(reel) {
    if (BONUS4_XWAYS4_REELS.includes(reel)) return 'xways4';
    if (BONUS4_XWILD4_REELS.includes(reel)) return 'xwild4';
    return null;
  }

  function reelHasBonus4Builder(b, reel) {
    for (let row = 0; row < getReelRows(reel); row++) {
      const s = b[reel][row];
      if (s === 'xways4' || s === 'xwild4' || s === 'wild4') return true;
    }
    return false;
  }

  function placeBonus4Builders(b) {
    if (!isBonus4Mode()) return;
    for (const reel of BONUS4_TORPEDO_REELS) {
      if (torpedoReelBlocked(reel)) continue;
      if (getXNudgeVisibleCount(b[reel]) > 0) continue;
      if (reelHasBonus4Builder(b, reel)) continue;
      if (Math.random() > BONUS4_BUILDER_LAND_CHANCE) continue;
      const sym = expectedTorpedoOverlay(reel);
      if (!sym) continue;
      const row = randomInt(0, getReelRows(reel) - 1);
      b[reel][row] = sym;
    }
  }

  /** Ways на барабане: символы поля (включая wild4) + доп. символ в слоте торпеды при полной сборке. */
  function countWaysOnReel(sym, b, m, reel) {
    let count = 0;
    for (let row = 0; row < getReelRows(reel); row++) {
      if (cellMatches(sym, b[reel][row])) count += m[reel][row] || 1;
    }
    if (torpedoResolved) {
      const slot = torpedoSlotForReel(reel);
      if (slot >= 0) {
        const t = torpedoResolved[slot];
        if (t && cellMatches(sym, t.sym)) count += t.mult || 1;
      }
    }
    return count;
  }

  function calculateWaysWin(betAmt, b, m) {
    let totalWin = 0;
    let totalWays = 0;
    const wins = [];
    const highlights = [];
    const highlightKeys = new Set();
    let peakNudgeMult = 1;

    for (const sym of PAYABLE) {
      let reelsMatched = 0;
      let ways = 1;
      let nudgeLineMult = 1;

      for (let r = 0; r < NUM_REELS; r++) {
        const countOnReel = countWaysOnReel(sym, b, m, r);
        if (countOnReel === 0) break;
        reelsMatched++;
        ways *= countOnReel;
        nudgeLineMult *= reelNudgeMult[r] || 1;
      }

      if (reelsMatched < 3) continue;
      const payTable = PAYOUTS[sym];
      const payMult = payTable[reelsMatched] ?? payTable[6] ?? 0;
      const win = betAmt * payMult * ways * nudgeLineMult;
      if (win <= 0) continue;

      wins.push({ sym, reelsMatched, ways, nudgeLineMult, win });
      peakNudgeMult = Math.max(peakNudgeMult, nudgeLineMult);
      totalWin += win;
      totalWays += ways;

      for (let r = 0; r < reelsMatched; r++) {
        const torpedoSlot = torpedoSlotForReel(r);
        if (torpedoResolved && torpedoSlot >= 0) {
          const t = torpedoResolved[torpedoSlot];
          if (t && cellMatches(sym, t.sym)) {
            const tKey = `torpedo:${torpedoSlot}`;
            if (!highlightKeys.has(tKey)) {
              highlightKeys.add(tKey);
              highlights.push({ torpedoSlot });
            }
          }
        }
        for (let row = 0; row < getReelRows(r); row++) {
          if (!cellMatches(sym, b[r][row])) continue;
          const key = `${r}:${row}`;
          if (highlightKeys.has(key)) continue;
          highlightKeys.add(key);
          highlights.push({ reel: r, row });
        }
      }
    }

    return { totalWin, wins, totalWays, highlights, peakNudgeMult };
  }

  /** Все payable-символы, совпадающие на барабанах 1 и 2. */
  function getFirstTwoReelsMatchSymbols(b) {
    const matched = [];
    for (const sym of PAYABLE) {
      let onReel0 = false;
      let onReel1 = false;
      for (let row = 0; row < getReelRows(0); row++) {
        if (cellMatches(sym, b[0][row])) onReel0 = true;
      }
      for (let row = 0; row < getReelRows(1); row++) {
        if (cellMatches(sym, b[1][row])) onReel1 = true;
      }
      if (onReel0 && onReel1) matched.push(sym);
    }
    return matched;
  }

  function reelHasPayableSymbol(b, reelIndex, sym) {
    for (let row = 0; row < getReelRows(reelIndex); row++) {
      if (cellMatches(sym, b[reelIndex][row])) return true;
    }
    return false;
  }

  /** Барабан участвует в ways-tease: payable/wild или xNudge-стопка в цепочке. */
  function reelMatchesWaysTease(b, reelIndex, sym) {
    if (reelHasPayableSymbol(b, reelIndex, sym)) return true;
    return (
      getActiveXNudgeReels().includes(reelIndex) &&
      symbolsHaveXNudgeStack(b[reelIndex])
    );
  }

  function payMultForMatchedReels(sym, reelsMatched) {
    const payTable = PAYOUTS[sym];
    return payTable[reelsMatched] ?? payTable[6] ?? 0;
  }

  /** Лучший payable-символ, совпадающий на барабанах 0..upToReel включительно. */
  function getWaysTeaseSymbol(b, upToReelInclusive) {
    const reelsMatched = upToReelInclusive + 1;
    if (reelsMatched < WAYS_TEASE_MIN_REELS) return null;

    let bestSym = null;
    let bestPay = 0;
    for (const sym of PAYABLE) {
      let ok = true;
      for (let r = 0; r <= upToReelInclusive; r++) {
        if (!reelMatchesWaysTease(b, r, sym)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const pay = payMultForMatchedReels(sym, reelsMatched);
      if (pay > bestPay) {
        bestPay = pay;
        bestSym = sym;
      }
    }
    return bestSym;
  }

  function mergeExtraStopMsByReel(...maps) {
    const out = {};
    for (const map of maps) {
      if (!map) continue;
      for (const key of Object.keys(map)) {
        const i = Number(key);
        const add = Math.max(0, Number(map[key]) || 0);
        if (add > 0) out[i] = (out[i] || 0) + add;
      }
    }
    return out;
  }

  function mergeInterReelGapMs(...maps) {
    const out = {};
    for (const map of maps) {
      if (!map) continue;
      for (const key of Object.keys(map)) {
        const i = Number(key);
        const add = Math.max(0, Number(map[key]) || 0);
        if (add > 0) out[i] = (out[i] || 0) + add;
      }
    }
    return out;
  }

  function playWaysChainSound(reelsMatched) {
    const file = WAYS_HIT_SOUNDS[reelsMatched];
    if (file) playSlotSound(file);
  }

  function buildWaysTeasePlan(b) {
    const waysInterReelGapMs = {};
    for (let nextReel = WAYS_TEASE_MIN_REELS; nextReel < NUM_REELS; nextReel++) {
      const upTo = nextReel - 1;
      if (getWaysTeaseSymbol(b, upTo)) {
        waysInterReelGapMs[nextReel] =
          (waysInterReelGapMs[nextReel] || 0) + WAYS_TEASE_INTER_REEL_MS;
      }
    }

    const hasTease = Object.keys(waysInterReelGapMs).length > 0;
    const state = { lastWaysSoundReels: 0 };

    return {
      waysInterReelGapMs,
      hasTease,
      onReelSettled(reelIdx, board) {
        if (reelIdx < WAYS_TEASE_MIN_REELS - 1) return;

        const sym = getWaysTeaseSymbol(board, reelIdx);
        const matched = sym ? reelIdx + 1 : 0;

        if (matched >= WAYS_TEASE_MIN_REELS && matched <= NUM_REELS) {
          if (matched > state.lastWaysSoundReels) {
            playWaysChainSound(matched);
          }
          state.lastWaysSoundReels = matched;
        } else {
          state.lastWaysSoundReels = 0;
        }

        if (!sym) {
          clearWaysTeaseHighlights();
          return;
        }
        setWaysTeaseHighlights(board, sym, 0, reelIdx, true);
      },
      clear() {
        clearWaysTeaseHighlights();
        state.lastWaysSoundReels = 0;
      }
    };
  }

  function clearWaysTeaseHighlights() {
    document
      .querySelectorAll('.symbol.ways-tease-blink, .xnudge-stack.ways-tease-blink')
      .forEach((el) => {
        el.classList.remove('ways-tease-blink');
      });
  }

  function setWaysTeaseHighlights(b, sym, fromReel, toReel, active) {
    clearWaysTeaseHighlights();
    if (!active || !sym) return;
    for (let r = fromReel; r <= toReel; r++) {
      if (!reelMatchesWaysTease(b, r, sym)) continue;
      for (let row = 0; row < getReelRows(r); row++) {
        const cell = b[r][row];
        if (!cellMatches(sym, cell) && cell !== 'xNudge') continue;
        const el = getSymbolEl(r, row);
        if (el) el.classList.add('ways-tease-blink');
      }
      if (symbolsHaveXNudgeStack(b[r])) {
        getReelViewport(r)
          ?.querySelector(':scope > .xnudge-stack')
          ?.classList.add('ways-tease-blink');
      }
    }
  }

  function countScatters(b) {
    let n = 0;
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        if (b[r][row] === 'scatter') n++;
      }
    }
    return n;
  }

  function reelHasScatter(b, reelIndex) {
    for (let row = 0; row < getReelRows(reelIndex); row++) {
      if (b[reelIndex][row] === 'scatter') return true;
    }
    return false;
  }

  function countScattersOnReels(b, reelIndices) {
    let n = 0;
    for (const r of reelIndices) {
      if (reelHasScatter(b, r)) n += 1;
    }
    return n;
  }

  function setScatterPreludeActive(active) {
    document.querySelector('.game-wrap')?.classList.toggle('scatter-prelude-active', active);
  }

  function stopScatterPreludeSound() {
    if (!scatterPreludeAudio) return;
    try {
      scatterPreludeAudio.pause();
      scatterPreludeAudio.currentTime = 0;
      scatterPreludeAudio.loop = false;
    } catch {
      /* ignore */
    }
    scatterPreludeAudio = null;
  }

  function startScatterPreludeSound() {
    stopScatterPreludeSound();
    try {
      if (!slotSoundCache[SOUND_PRELUDE]) {
        const a = new Audio(soundUrl(SOUND_PRELUDE));
        a.preload = 'auto';
        slotSoundCache[SOUND_PRELUDE] = a;
      }
      scatterPreludeAudio = slotSoundCache[SOUND_PRELUDE];
      scatterPreludeAudio.loop = false;
      scatterPreludeAudio.currentTime = 0;
      void scatterPreludeAudio.play().catch(() => {});
    } catch {
      scatterPreludeAudio = null;
    }
  }

  function endScatterPreludeFx() {
    stopScatterPreludeSound();
    setScatterPreludeActive(false);
  }

  function buildScatterSpinPlan(b, opts = {}) {
    const scatterInterReelGapMs = {};
    let usePrelude = false;
    let preludeTriggerReel = -1;
    let lastTeaseDelayReel = -1;
    const scatterGuarantee =
      opts.scatterGuarantee === 3 || opts.scatterGuarantee === 4 ? opts.scatterGuarantee : 0;

    const addScatterTeaseGap = (fromReel, toReel) => {
      const count = Math.max(0, toReel - fromReel + 1);
      if (!count) return;
      let assigned = 0;
      for (let r = fromReel; r <= toReel; r++) {
        const isLast = r === toReel;
        const add = isLast
          ? SCATTER_TEASE_TOTAL_MS - assigned
          : Math.floor(SCATTER_TEASE_TOTAL_MS / count);
        scatterInterReelGapMs[r] = (scatterInterReelGapMs[r] || 0) + add;
        assigned += add;
        lastTeaseDelayReel = r;
      }
    };

    if (!bonusMode) {
      const scatterReelsHit = SCATTER_REELS.filter((r) => reelHasScatter(b, r)).sort(
        (a, b) => a - b
      );

      if (scatterGuarantee >= 3 && scatterReelsHit.length >= scatterGuarantee) {
        usePrelude = true;
        preludeTriggerReel = scatterReelsHit[1];
        addScatterTeaseGap(
          preludeTriggerReel + 1,
          scatterReelsHit[scatterGuarantee - 1]
        );
      } else if (scatterReelsHit.length >= 3) {
        usePrelude = true;
        preludeTriggerReel = scatterReelsHit[1];
        addScatterTeaseGap(
          preludeTriggerReel + 1,
          scatterReelsHit[scatterReelsHit.length - 1]
        );
      } else if (scatterReelsHit.length === 2) {
        usePrelude = true;
        preludeTriggerReel = Math.max(...scatterReelsHit);
        addScatterTeaseGap(
          preludeTriggerReel + 1,
          SCATTER_REELS[SCATTER_REELS.length - 1]
        );
      }
    }

    const state = {
      scattersLanded: 0,
      usePrelude,
      preludeTriggerReel,
      lastTeaseDelayReel
    };

    return {
      scatterInterReelGapMs,
      onReelSettled(reelIdx, board) {
        if (state.usePrelude && reelIdx === state.preludeTriggerReel) {
          setScatterPreludeActive(true);
          startScatterPreludeSound();
        }

        if (!SCATTER_REELS.includes(reelIdx) || !reelHasScatter(board, reelIdx)) {
          if (state.usePrelude && reelIdx === state.lastTeaseDelayReel) {
            endScatterPreludeFx();
          }
          return;
        }

        state.scattersLanded += 1;
        if (state.scattersLanded === 4) {
          playSlotSound(SOUND_SCATTER4);
        } else if (state.scattersLanded === 3) {
          playSlotSound(SOUND_SCATTER3);
        } else {
          playSlotSound(SOUND_SCATTER);
        }

        if (state.usePrelude && reelIdx === state.lastTeaseDelayReel) {
          endScatterPreludeFx();
        }
      },
      clear() {
        endScatterPreludeFx();
      }
    };
  }

  function placeXNudgeStacksOnBoard(b) {
    const nudgeReels = getActiveXNudgeReels();
    if (!nudgeReels.length) return [];
    const stacks = [];
    for (const reel of nudgeReels) {
      if (Math.random() > XNUDGE_LAND_CHANCE) continue;
      const rows = getReelRows(reel);
      const visible = randomInt(1, Math.min(XNUDGE_STACK_SIZE, rows));
      for (let row = 0; row < visible; row++) b[reel][row] = 'xNudge';
      stacks.push({ reel, visible });
    }
    return stacks;
  }

  function generateRawBoard() {
    const b = activeReelRows.map((_, r) => generateReelColumn(r, { bonus: bonusMode }));
    if (isBonus4Mode()) {
      if (getActiveXNudgeReels().length) placeXNudgeStacksOnBoard(b);
      placeBonus4Builders(b);
    } else if (getActiveXNudgeReels().length) placeXNudgeStacksOnBoard(b);
    return b;
  }

  function detectXNudgeStacks(b) {
    const stacks = [];
    for (const reel of getActiveXNudgeReels()) {
      let visible = 0;
      for (let row = 0; row < getReelRows(reel); row++) {
        if (b[reel][row] === 'xNudge') visible += 1;
        else break;
      }
      if (visible > 0) stacks.push({ reel, visible });
    }
    return stacks;
  }

  function playNudgeLandSoundOnReelSettled(reelIdx, board) {
    if (!getActiveXNudgeReels().includes(reelIdx)) return;
    if (getXNudgeLandInfo(board[reelIdx])) {
      playSlotSound(SOUND_NUDGE);
    }
  }

  function boardHasXNudgeStacks(b) {
    return getActiveXNudgeReels().some((r) => symbolsHaveXNudgeStack(b[r]));
  }

  function clearReelXNudgeOverlays(reel) {
    getNudgeStackHost(reel)?.querySelectorAll('.xnudge-stack').forEach((el) => el.remove());
    getReelContent(reel)?.querySelectorAll('.xnudge-stack').forEach((el) => el.remove());
    getReelViewport(reel)?.querySelectorAll('.xnudge-stack').forEach((el) => el.remove());
  }

  function syncSpinBoardFromRaw(b, m, raw) {
    for (let r = 0; r < NUM_REELS; r++) {
      b[r] = raw[r].map((s) => s);
      if (m[r]?.length === getReelRows(r)) {
        m[r] = m[r].map((n) => Number(n) || 1);
      }
    }
  }

  function resolveXWays(b, m) {
    const replacement = PAYABLE[Math.floor(Math.random() * PAYABLE.length)];
    const positions = [];
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        if (b[r][row] === 'xWays') positions.push({ r, row });
      }
    }
    return { positions, replacement };
  }

  function applyXWaysFinal(b, m, positions, replacement) {
    for (const { r, row } of positions) {
      b[r][row] = replacement;
      m[r][row] = randomInt(2, 6);
    }
  }

  function getReelNudgeMultEl(reel) {
    return getReelCol(reel)?.querySelector('.reel-nudge-mult') || null;
  }

  function updateReelNudgeMultDisplay(reel, mult) {
    const el = getReelNudgeMultEl(reel);
    if (!el) return;
    if (mult > 1) {
      el.textContent = `x${mult}`;
      el.classList.add('visible');
    } else {
      el.textContent = '';
      el.classList.remove('visible', 'bump');
    }
  }

  function resetAllReelNudgeDisplays() {
    for (let r = 0; r < NUM_REELS; r++) {
      if (reelHasXNudgeLane(r)) updateReelNudgeMultDisplay(r, 1);
    }
  }

  function playXWaysLandSoundOnReelSettled(reelIdx, board) {
    if (!getActiveXWAYSReels().includes(reelIdx)) return;
    for (let row = 0; row < getReelRows(reelIdx); row++) {
      if (board[reelIdx][row] === 'xWays') {
        playSlotSound(SOUND_WAYS);
        return;
      }
    }
  }

  function bumpReelNudgeMultDisplay(reel) {
    const el = getReelNudgeMultEl(reel);
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 220);
  }

  function getReelCol(reel) {
    return document.querySelector(`.reel-col[data-reel="${reel}"]`);
  }

  function getReelViewport(reel) {
    return getReelCol(reel)?.querySelector('.reel-viewport') || null;
  }

  function getReelContent(reel) {
    return getReelViewport(reel)?.querySelector('.reel-content') || null;
  }

  function getReelDrum(reel) {
    return getReelViewport(reel)?.querySelector(':scope > .reel-drum') || null;
  }

  function getNudgeStackHost(reel) {
    return getReelDrum(reel) || getReelViewport(reel);
  }

  /** Какие ряды board[] рисовать в DOM (3-й барабан в бонусе до расширения = нижние 4). */
  function getReelStripView(reel, symbols, multsRow) {
    const base = BASE_REEL_ROWS[reel];
    if (
      bonusMode &&
      reel === BONUS_EXPAND_REEL &&
      symbols.length >= BONUS_EXPAND_ROWS &&
      !bonusReelExpanded
    ) {
      return {
        symbols: symbols.slice(base),
        mults: multsRow.slice(base)
      };
    }
    return { symbols, mults: multsRow };
  }

  function getSymbolEl(reel, row) {
    const content = getReelContent(reel);
    const symbols = content?.querySelectorAll('.symbol');
    if (!symbols?.length) return null;
    let domIdx = row;
    if (
      bonusMode &&
      reel === BONUS_EXPAND_REEL &&
      board[reel]?.length >= BONUS_EXPAND_ROWS &&
      !bonusReelExpanded
    ) {
      domIdx = row - BASE_REEL_ROWS[reel];
    }
    return symbols[domIdx] || null;
  }

  /** Сколько xNudge подряд с верхнего ряда (частичная стопка при генерации). */
  function getXNudgeVisibleCount(symbols) {
    if (!symbols?.length) return 0;
    let n = 0;
    for (let row = 0; row < symbols.length; row++) {
      if (symbols[row] !== 'xNudge') break;
      n++;
    }
    return n;
  }

  /** Стартовый ряд xNudge в книге: ×2 → ¾, ×3 → ½, ×4+ → верх. */
  function bookNudgeLandRow(rows, targetMult) {
    const maxRow = Math.max(0, rows - 1);
    if (targetMult <= 2) return Math.floor((maxRow * 3) / 4);
    if (targetMult === 3) return Math.floor(maxRow / 2);
    return 0;
  }

  /** Полная стопка на лендинге → один xNudge для толчков (как в книге). */
  function collapseNudgeStackForAnim(b, reel, targetMult) {
    const rows = getReelRows(reel);
    const mult = Math.max(
      1,
      Math.min(Number(targetMult) || 1, getXNudgeStackSize(reel), rows)
    );
    if (mult <= 1) return mult;
    const landRow = bookNudgeLandRow(rows, mult);
    for (let row = 0; row < rows; row++) {
      if (row === landRow) b[reel][row] = 'xNudge';
      else if (b[reel][row] === 'xNudge') {
        b[reel][row] = pickRandomSymbol(reel, {
          bonus: bonusMode,
          omitScatter: true
        });
      }
    }
    return mult;
  }

  /** Стопка сверху или одиночный xNudge ниже (книжный лендинг). */
  function getXNudgeLandInfo(symbols) {
    if (!symbols?.length) return null;
    const topVisible = getXNudgeVisibleCount(symbols);
    if (topVisible > 0) {
      return { anchorRow: 0, visible: topVisible, dropped: false };
    }
    const anchorRow = symbols.indexOf('xNudge');
    if (anchorRow < 0) return null;
    return { anchorRow, visible: 1, dropped: true };
  }

  /** Текущая позиция стопки на барабане (для толчков — всегда из актуального board). */
  function getNudgeStackPose(symbols, reel = -1) {
    const info = getXNudgeLandInfo(symbols);
    if (!info) return null;
    const h = getSymbolHeight();
    return {
      visible: info.visible,
      topPx: info.dropped ? info.anchorRow * h : 0,
      dropped: info.dropped,
      anchorRow: info.anchorRow
    };
  }

  function symbolsHaveXNudgeStack(symbols) {
    return getXNudgeLandInfo(symbols) != null;
  }

  /** Целый xNudge.png; низ спрайта на низе visible-стопки (в окне — нижние visible/4 файла). */
  function applyXNudgeStackFullFile(el, visibleRows, topOffsetPx = 0, reel = -1) {
    const stackSize = getXNudgeStackSize(reel);
    const v = Math.max(0.001, Math.min(stackSize, Number(visibleRows) || 0));
    const h = getSymbolHeight();
    el.style.backgroundImage = `url(${xNudgeArtUrl(reel)})`;
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundSize = '100% 100%';
    el.style.backgroundPosition = '50% 50%';
    el.style.height = `${stackSize * h}px`;
    el.style.top = `${Math.round(topOffsetPx + v * h - stackSize * h)}px`;
    el.style.transform = '';
  }

  function applyXNudgePlaceholder(el) {
    el.dataset.symbol = 'xNudge';
    el.style.backgroundImage = 'none';
    el.classList.add('symbol--xnudge-slot');
    el.classList.remove('symbol--xnudge', 'symbol--xnudge-spin-cluster');
  }

  /** В ленте прокрутки — один блок на 4 ряда, целый xNudge.png. */
  function createXNudgeSpinClusterElement(reelIndex = -1) {
    const h = getSymbolHeight();
    const stackSize = getXNudgeStackSize(reelIndex);
    const el = document.createElement('div');
    el.className = 'symbol xnudge-spin-cluster';
    el.dataset.symbol = 'xNudge';
    el.style.height = `${stackSize * h}px`;
    el.style.backgroundImage = `url(${xNudgeArtUrl(reelIndex)})`;
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundSize = '100% 100%';
    el.style.backgroundPosition = '50% 50%';
    return el;
  }

  function buildSpinStripItems(reelIndex, targetLen) {
    const items = [];
    const canCluster =
      reelIndex >= 0 && getActiveXNudgeReels().includes(reelIndex);
    let len = 0;

    while (len < targetLen) {
      const remaining = targetLen - len;
      if (
        canCluster &&
        remaining >= XNUDGE_STACK_SIZE &&
        Math.random() < XNUDGE_CLUSTER_STRIP_CHANCE
      ) {
        items.push({ type: 'xnudgeCluster' });
        len += XNUDGE_STACK_SIZE;
        continue;
      }
      items.push({
        type: 'sym',
        sym: pickRandomSymbol(reelIndex, {
          bonus: bonusMode,
          omitScatter: true,
          spinStrip: true
        })
      });
      len += 1;
    }
    return items;
  }

  function appendSpinStripItems(frag, items, reelIndex = -1) {
    for (const item of items) {
      if (item.type === 'xnudgeCluster') {
        frag.appendChild(createXNudgeSpinClusterElement(reelIndex));
      } else {
        frag.appendChild(cloneStripSymbol(item.sym, 0, null, { spinStrip: true }));
      }
    }
  }

  function createXNudgeStackElement() {
    const layer = document.createElement('div');
    layer.className = 'xnudge-stack';
    layer.setAttribute('aria-hidden', 'true');
    return layer;
  }

  function mountStripXNudgeStack(content, symbols, topPx = 0, reel = -1) {
    if (!content) return;
    content.querySelector('.xnudge-strip-stack')?.remove();
    const visible = getXNudgeVisibleCount(symbols);
    if (!visible) return;

    const h = getSymbolHeight();
    const layer = createXNudgeStackElement();
    layer.classList.add('xnudge-strip-stack');
    layer.style.transform = '';
    applyXNudgeStackFullFile(layer, visible, topPx, reel);
    content.appendChild(layer);
  }

  function syncXNudgeStackLayer(reel, symbols) {
    const host = getNudgeStackHost(reel);
    const content = getReelContent(reel);
    if (!host) return;
    content?.querySelector('.xnudge-strip-stack')?.remove();
    content?.querySelector('.xnudge-stack:not(.xnudge-strip-stack)')?.remove();

    const info = getXNudgeLandInfo(symbols);
    let layer = host.querySelector(':scope > .xnudge-stack:not(.xnudge-strip-stack)');
    if (!info) {
      layer?.remove();
      return;
    }

    const h = getSymbolHeight();
    if (!layer) {
      layer = createXNudgeStackElement();
      host.insertBefore(layer, content || null);
    }
    layer.classList.remove('xnudge-stack--full', 'xnudge-stack--pushing');
    layer.style.top = '';
    layer.style.transform = '';
    const topOffsetPx = info.dropped ? info.anchorRow * h : 0;
    applyXNudgeStackFullFile(layer, info.visible, topOffsetPx, reel);
  }

  function applyStripSymbolToEl(el, sym, mult, symbols, opts = {}) {
    if (!el) return;
    el.className = 'symbol';
    if (sym === 'target') el.classList.add('symbol--target');
    if (
      sym === 'xNudge' &&
      symbols &&
      symbolsHaveXNudgeStack(symbols) &&
      !opts.showXNudgeArt
    ) {
      applyXNudgePlaceholder(el);
      return;
    }
    setSymbolVisual(el, sym, mult);
  }

  function cloneStripSymbol(sym, mult = 0, symbols = null, opts = {}) {
    const el = document.createElement('div');
    applyStripSymbolToEl(el, sym, mult, symbols, opts);
    return el;
  }

  /** Обновить ячейки без replaceChildren — без мигания между толчками. */
  function syncReelSymbolCellsInPlace(reel, symbols, multsRow) {
    const content = getReelContent(reel);
    if (!content) return false;
    const view = getReelStripView(reel, symbols, multsRow);
    const cells = content.querySelectorAll(':scope > .symbol');
    if (cells.length !== view.symbols.length) return false;

    for (let i = 0; i < view.symbols.length; i++) {
      applyStripSymbolToEl(
        cells[i],
        view.symbols[i],
        view.mults[i] || 1,
        view.symbols
      );
    }
    reelTransformY(content, 0);
    content.style.transition = 'none';
    return true;
  }

  function applyBonus4StackVisual(el, sym) {
    el.classList.add('symbol--bonus4-stack');
    el.style.backgroundImage = 'none';
    el.replaceChildren();
    const base = document.createElement('span');
    base.className = 'symbol-bonus4-base';
    base.setAttribute('aria-hidden', 'true');
    base.style.backgroundImage = `url(${symbolSrc('wild4')})`;
    el.appendChild(base);
    if (sym === 'xways4' || sym === 'xwild4') {
      const over = document.createElement('span');
      over.className = 'symbol-bonus4-overlay';
      over.setAttribute('aria-hidden', 'true');
      over.style.backgroundImage = `url(${symbolSrc(sym)})`;
      el.appendChild(over);
    }
  }

  function setSymbolVisual(el, sym, mult) {
    if (!el) return;
    el.dataset.symbol = sym;
    el.classList.remove(
      'symbol--xnudge-slot',
      'symbol--xnudge-spin-cluster',
      'symbol--bonus4-stack'
    );
    el.classList.toggle('symbol--target', sym === 'target');
    el.classList.remove('xways-flicker', 'xnudge-glow');
    el.replaceChildren();
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.backgroundRepeat = '';
    el.classList.toggle('symbol--xnudge', sym === 'xNudge');

    if (sym === 'xways4' || sym === 'xwild4' || sym === 'wild4') {
      applyBonus4StackVisual(el, sym);
    } else {
      el.style.backgroundImage = `url(${symbolSrc(sym)})`;
    }

    let badge = el.querySelector('.symbol-mult');
    if (badge) badge.remove();
    if (
      mult > 1 &&
      sym !== 'xNudge' &&
      sym !== 'wild4' &&
      sym !== 'xways4' &&
      sym !== 'xwild4'
    ) {
      badge = document.createElement('span');
      badge.className = 'symbol-mult';
      badge.textContent = `x${mult}`;
      el.appendChild(badge);
    }
  }

  function renderReelContent(reel, symbols, multsRow, contentOffsetY = 0, opts = {}) {
    const content = getReelContent(reel);
    if (!content) return;
    const view = getReelStripView(reel, symbols, multsRow);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < view.symbols.length; i++) {
      frag.appendChild(
        cloneStripSymbol(view.symbols[i], view.mults[i] || 1, view.symbols, opts)
      );
    }
    content.replaceChildren(frag);
    content.querySelector('.xnudge-strip-stack')?.remove();
    content.querySelector('.xnudge-stack')?.remove();
    reelTransformY(content, contentOffsetY);
    content.style.transition = 'none';
  }

  function renderReelStrip(reel, symbols, multsRow, contentOffsetY = 0) {
    renderReelContent(reel, symbols, multsRow, contentOffsetY);
    syncXNudgeStackLayer(reel, symbols);
  }

  /** Полная лента 8 рядов (для анимации расширения 3-го барабана). */
  function renderBonusReelFullStrip(reel, symbols, multsRow, contentOffsetY = 0) {
    const content = getReelContent(reel);
    if (!content) return;
    const frag = document.createDocumentFragment();
    for (let row = 0; row < symbols.length; row++) {
      frag.appendChild(
        cloneStripSymbol(symbols[row], multsRow[row] || 1, symbols)
      );
    }
    content.replaceChildren(frag);
    reelTransformY(content, contentOffsetY);
    content.style.transition = 'none';
    syncXNudgeStackLayer(reel, symbols);
  }

  function renderBoard(b, m) {
    for (let r = 0; r < NUM_REELS; r++) {
      renderReelStrip(r, b[r], m[r]);
    }
  }

  function buildReelsDom() {
    const grid = document.getElementById('reelsGrid');
    grid.innerHTML = '';
    cachedSymbolHeightPx = 0;
    updateResponsiveSlotSize();
    for (let r = 0; r < NUM_REELS; r++) {
      const col = document.createElement('div');
      col.className = 'reel-col';
      col.dataset.reel = String(r);

      const viewport = document.createElement('div');
      viewport.className = 'reel-viewport';
      viewport.style.setProperty('--rows', String(getReelRows(r)));
      col.classList.toggle(
        'reel-col--expanded',
        bonusMode && bonusReelExpanded && r === BONUS_EXPAND_REEL
      );
      col.classList.toggle(
        'reel-col--grow-up',
        bonusMode && bonusReelExpanded && r === BONUS_EXPAND_REEL
      );

      const content = document.createElement('div');
      content.className = 'reel-content';
      const stripView = getReelStripView(r, board[r], mults[r]);
      for (let i = 0; i < stripView.symbols.length; i++) {
        content.appendChild(
          cloneStripSymbol(
            stripView.symbols[i],
            stripView.mults[i] || 1,
            stripView.symbols
          )
        );
      }
      reelTransformY(content, 0);

      const drum = document.createElement('div');
      drum.className = 'reel-drum';
      drum.appendChild(content);
      viewport.appendChild(drum);
      reelTransformY(drum, 0);
      syncXNudgeStackLayer(r, stripView.symbols);
      col.appendChild(viewport);

      if (
        reelHasXNudgeLane(r)
      ) {
        col.classList.add('has-xnudge-lane');
        const badge = document.createElement('div');
        badge.className = 'reel-nudge-mult';
        badge.setAttribute('aria-hidden', 'true');
        col.appendChild(badge);
      }

      grid.appendChild(col);
    }
    requestAnimationFrame(() => {
      refreshSymbolHeightCache();
      renderBoard(board, mults);
    });
  }

  function getBetCostMultiplier() {
    if (pendingScatterGuarantee === 3) return BUY_SCATTER3_MULT;
    if (pendingScatterGuarantee === 4) return BUY_SCATTER4_MULT;
    return 1;
  }

  function getFinalBet() {
    return bet * getBetCostMultiplier();
  }

  function syncModUI() {
    const buttons = [
      { id: 'modScatter3', count: 3 },
      { id: 'modScatter4', count: 4 }
    ];
    for (const { id, count } of buttons) {
      const el = document.getElementById(id);
      if (!el) continue;
      const active = pendingScatterGuarantee === count;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    const modBtn = document.getElementById('modBtn');
    if (modBtn) modBtn.classList.toggle('active', pendingScatterGuarantee > 0);
  }

  function updateBetNote() {
    const betNote = document.getElementById('betNote');
    if (!betNote) return;
    if (pendingScatterGuarantee <= 0) {
      betNote.style.display = 'none';
      betNote.textContent = '';
      return;
    }
    betNote.style.display = 'block';
    betNote.textContent = `основная ставка — ${getFinalBet().toFixed(2)}`;
  }

  function setScatterMod(count) {
    if (isSpinning || bonusMode) return;
    pendingScatterGuarantee = pendingScatterGuarantee === count ? 0 : count;
    syncModUI();
    updateBetNote();
  }

  function closeModPanel() {
    const panel = document.getElementById('modPanel');
    if (panel) panel.style.display = 'none';
  }

  function toggleModPanel() {
    if (isSpinning || bonusMode) return;
    const panel = document.getElementById('modPanel');
    if (!panel) return;
    const open = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = open ? 'block' : 'none';
  }

  function syncControlsState() {
    const locked = isSpinning || replayMode;
    const spinBtn = document.getElementById('spinBtn');
    const betUp = document.getElementById('betUp');
    const betDown = document.getElementById('betDown');
    const modBtn = document.getElementById('modBtn');
    if (spinBtn) {
      spinBtn.disabled = locked;
      spinBtn.textContent = bonusMode && freeSpinsRemaining > 0 ? 'FREE SPIN' : 'SPIN';
    }
    if (betUp) betUp.disabled = locked || bonusMode;
    if (betDown) betDown.disabled = locked || bonusMode;
    if (modBtn) {
      modBtn.disabled = locked || bonusMode;
      modBtn.setAttribute('aria-disabled', locked || bonusMode ? 'true' : 'false');
    }
  }

  function updateBonusHud() {
    const hud = document.getElementById('bonusHud');
    const spinsEl = document.getElementById('bonusSpinsLeft');
    const totalEl = document.getElementById('bonusTotalWin');
    if (!hud || !spinsEl || !totalEl) return;
    if (bonusMode) {
      hud.hidden = false;
      spinsEl.textContent = `Фриспинов: ${freeSpinsRemaining}`;
      totalEl.textContent = `Итого: ${bonusTotalWin.toFixed(2)}`;
    } else {
      hud.hidden = true;
    }
  }

  function setTargetTeaseActive(active) {
    const col = getReelCol(BONUS_EXPAND_REEL);
    if (!col) return;
    col.classList.toggle('target-tease-active', active);
  }

  function setTeaseMatchHighlights(b, matchSyms, active) {
    const syms = Array.isArray(matchSyms) ? matchSyms : matchSyms ? [matchSyms] : [];
    for (let r = 0; r <= 1; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        const el = getSymbolEl(r, row);
        if (!el) continue;
        if (!active) {
          el.classList.remove('tease-match-blink');
          continue;
        }
        const on = syms.some((sym) => cellMatches(sym, b[r][row]));
        el.classList.toggle('tease-match-blink', on);
      }
    }
  }

  function setBonusPreludeReelGlow(reelIndex, active) {
    getReelCol(reelIndex)?.classList.toggle('bonus-prelude-reel-glow', active);
  }

  function setTargetPreludeActive(active) {
    document.querySelector('.game-wrap')?.classList.toggle('target-prelude-active', active);
  }

  let targetPreludeAudio = null;

  function stopTargetPreludeSound() {
    if (!targetPreludeAudio) return;
    try {
      targetPreludeAudio.pause();
      targetPreludeAudio.currentTime = 0;
      targetPreludeAudio.loop = false;
    } catch {
      /* ignore */
    }
    targetPreludeAudio = null;
  }

  function startTargetPreludeSound() {
    stopTargetPreludeSound();
    try {
      if (!slotSoundCache[SOUND_PRELUDE_TARGET]) {
        const a = new Audio(soundUrl(SOUND_PRELUDE_TARGET));
        a.preload = 'auto';
        slotSoundCache[SOUND_PRELUDE_TARGET] = a;
      }
      targetPreludeAudio = slotSoundCache[SOUND_PRELUDE_TARGET];
      targetPreludeAudio.loop = false;
      targetPreludeAudio.currentTime = 0;
      void targetPreludeAudio.play().catch(() => {});
    } catch {
      targetPreludeAudio = null;
    }
  }

  /** Красная прелюдия + prelude_target.ogg пока 3-й барабан крутится (4 с tease). */
  function buildBonusTargetPreludePlan(matchSyms) {
    if (!matchSyms?.length) {
      return { active: false, onReelSettled() {}, clear() {} };
    }

    const state = { ended: false, started: false, lastBoard: null };

    const endFx = () => {
      if (state.ended) return;
      state.ended = true;
      stopTargetPreludeSound();
      setTargetPreludeActive(false);
      if (state.lastBoard) {
        setTeaseMatchHighlights(state.lastBoard, matchSyms, false);
      } else {
        document
          .querySelectorAll('.symbol.tease-match-blink')
          .forEach((el) => el.classList.remove('tease-match-blink'));
      }
      setBonusPreludeReelGlow(0, false);
      setBonusPreludeReelGlow(1, false);
      getReelCol(BONUS_EXPAND_REEL)?.classList.remove('target-tease-active');
    };

    const startFx = (board) => {
      if (state.started || state.ended) return;
      state.started = true;
      state.lastBoard = board;
      setTargetPreludeActive(true);
      startTargetPreludeSound();
      setTeaseMatchHighlights(board, matchSyms, true);
      setBonusPreludeReelGlow(0, true);
      setBonusPreludeReelGlow(1, true);
      getReelCol(BONUS_EXPAND_REEL)?.classList.add('target-tease-active');
    };

    return {
      active: true,
      onReelSettled(reelIdx, board) {
        state.lastBoard = board;

        if (reelIdx === 0) {
          setTeaseMatchHighlights(board, matchSyms, true);
        }

        if (reelIdx === 1) {
          startFx(board);
        }

        if (reelIdx === BONUS_EXPAND_REEL) {
          endFx();
          if (findTargetOnBoard(board) >= 0) {
            playSlotSound(SOUND_TARGET);
          }
        }
      },
      clear: endFx
    };
  }

  function createTailSpinHold() {
    return { released: false, releasedAt: 0 };
  }

  let winOverlayCountTimeout = null;
  let winOverlayCountRaf = null;
  let winOverlayExitTimeout = null;
  let winPresentationTimeout = null;
  let winOverlayCountEndResolve = null;
  let bigWinStageRaf = null;
  let bigWinActiveAudio = null;
  /** Управление скипом этапов Big Win по клику. */
  let bigWinSkipCtrl = null;
  let reelSpinLoopAudio = null;
  let scatterPreludeAudio = null;
  let winCountBzzzAudio = null;
  let bonusEntryMusicAudio = null;
  let bonusEntryLoopTimeoutId = null;
  let bonusEndMusicAudio = null;
  let bonusEndBzzzAudio = null;
  let bonusEndSoundTimeouts = [];
  let bonusEndCounterRaf = null;
  let bgMusicAudio = null;
  let bgMusicFile = '';
  let bgMusicPausedForEffect = false;
  let bgMusicUnlocked = false;
  /** { totalMult, scale } — scale только растёт, между этапами не сбрасывается. */
  let bigWinCounterScaleState = null;
  let maxWinCounterRaf = null;
  let maxWinActiveAudio = null;
  let maxWinLoopAudio = null;
  const slotSoundCache = Object.create(null);

  function soundUrl(file) {
    return `images/${file}`;
  }

  function playSlotSound(file, { loop = false } = {}) {
    try {
      if (!slotSoundCache[file]) {
        const a = new Audio(soundUrl(file));
        a.preload = 'auto';
        slotSoundCache[file] = a;
      }
      const base = slotSoundCache[file];
      const audio = base.cloneNode();
      audio.loop = loop;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
      return audio;
    } catch {
      return null;
    }
  }

  function ensureSlotSoundCached(file) {
    if (!slotSoundCache[file]) {
      const a = new Audio(soundUrl(file));
      a.preload = 'auto';
      slotSoundCache[file] = a;
    }
    return slotSoundCache[file];
  }

  function stopBgMusic() {
    bgMusicPausedForEffect = false;
    if (!bgMusicAudio) return;
    try {
      bgMusicAudio.pause();
      bgMusicAudio.currentTime = 0;
      bgMusicAudio.loop = false;
    } catch {
      /* ignore */
    }
    bgMusicAudio = null;
    bgMusicFile = '';
  }

  function bonusMainMusicFile(scatterCount) {
    return scatterCount >= 4 ? SOUND_BONUS4_MAIN : SOUND_BONUS3_MAIN;
  }

  function startBgMusic(file) {
    if (!file) return;
    try {
      if (bgMusicFile === file && bgMusicAudio) {
        if (bgMusicAudio.paused) {
          bgMusicAudio.loop = true;
          void bgMusicAudio.play().catch(() => {});
        }
        bgMusicPausedForEffect = false;
        return;
      }
      stopBgMusic();
      const audio = ensureSlotSoundCached(file);
      bgMusicAudio = audio;
      bgMusicFile = file;
      audio.loop = true;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
      bgMusicPausedForEffect = false;
    } catch {
      bgMusicAudio = null;
      bgMusicFile = '';
      bgMusicPausedForEffect = false;
    }
  }

  /** Браузер блокирует autoplay — включаем main/bonus после первого клика. */
  function ensureBgMusicStarted() {
    bgMusicUnlocked = true;
    const file =
      bonusMode && bonusEntryScatterCount > 0
        ? bonusMainMusicFile(bonusEntryScatterCount)
        : SOUND_MAIN;
    startBgMusic(file);
  }

  function bindBgMusicUnlock() {
    const unlock = () => ensureBgMusicStarted();
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
  }

  function pauseBgMusic() {
    if (!bgMusicAudio || bgMusicAudio.paused) {
      bgMusicPausedForEffect = !!bgMusicFile;
      return;
    }
    try {
      bgMusicAudio.pause();
      bgMusicPausedForEffect = true;
    } catch {
      bgMusicPausedForEffect = false;
    }
  }

  function resumeBgMusic() {
    if (!bgMusicPausedForEffect || !bgMusicAudio || !bgMusicFile) {
      bgMusicPausedForEffect = false;
      return;
    }
    bgMusicPausedForEffect = false;
    try {
      bgMusicAudio.loop = true;
      void bgMusicAudio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function stopReelSpinSound() {
    if (!reelSpinLoopAudio) return;
    try {
      reelSpinLoopAudio.pause();
      reelSpinLoopAudio.currentTime = 0;
      reelSpinLoopAudio.loop = false;
    } catch {
      /* ignore */
    }
    reelSpinLoopAudio = null;
  }

  function startReelSpinSound() {
    stopReelSpinSound();
    try {
      if (!slotSoundCache[SOUND_SPIN]) {
        const a = new Audio(soundUrl(SOUND_SPIN));
        a.preload = 'auto';
        slotSoundCache[SOUND_SPIN] = a;
      }
      reelSpinLoopAudio = slotSoundCache[SOUND_SPIN];
      reelSpinLoopAudio.loop = true;
      reelSpinLoopAudio.currentTime = 0;
      void reelSpinLoopAudio.play().catch(() => {});
    } catch {
      reelSpinLoopAudio = null;
    }
  }

  function stopBigWinAudio() {
    if (bigWinActiveAudio) {
      try {
        bigWinActiveAudio.pause();
        bigWinActiveAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
      bigWinActiveAudio = null;
    }
  }

  function clearBigWinDomState() {
    endBigWinSkipCtrl();
    if (bigWinStageRaf) {
      cancelAnimationFrame(bigWinStageRaf);
      bigWinStageRaf = null;
    }
    stopBigWinAudio();
    clearBigWinPreludeMarks();
    const overlay = document.getElementById('bigWinOverlay');
    const badge = document.getElementById('bigWinNudgeBadge');
    if (badge) {
      badge.hidden = true;
      badge.setAttribute('aria-hidden', 'true');
    }
    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    const amountEl = document.getElementById('bigWinAmount');
    if (amountEl) amountEl.style.transform = '';
    bigWinCounterScaleState = null;
  }

  function updateBigWinCounterScale(mult) {
    const amountEl = document.getElementById('bigWinAmount');
    const state = bigWinCounterScaleState;
    if (!amountEl || !state?.totalMult) return;

    const t = Math.min(1, Math.max(0, (Number(mult) || 0) / state.totalMult));
    const targetScale = 1 + t * (BIG_WIN_COUNTER_SCALE_MAX - 1);
    state.scale = Math.max(state.scale, targetScale);
    amountEl.style.transform = `scale(${state.scale})`;
  }

  function getBigWinStageTitle(toMult) {
    if (toMult >= 500) return 'EPIC WIN';
    if (toMult >= 200) return 'MASSIVE WIN';
    if (toMult >= 100) return 'SUPER WIN';
    if (toMult >= 50) return 'BIG WIN';
    return 'BIG WIN';
  }

  function buildBigWinStages(totalMult) {
    const total = Math.max(0, Number(totalMult) || 0);
    const stages = [];
    let cursor = 0;

    for (const cap of BIG_WIN_TIER_CAPS) {
      if (cursor >= total - 1e-6) break;
      const to = Math.min(cap, total);
      stages.push({
        fromMult: cursor,
        toMult: to,
        title: getBigWinStageTitle(to)
      });
      cursor = cap;
      if (to >= total - 1e-6) return stages;
    }

    if (cursor < total - 1e-6) {
      stages.push({
        fromMult: cursor,
        toMult: total,
        title: getBigWinStageTitle(total)
      });
    }
    return stages;
  }

  /** DOM-цель подсветки/тряски: ячейка символа, стопка xNudge или торпеда. */
  function getWinHighlightTarget(reel, row) {
    if (reel == null || row == null || row < 0) return null;
    const sym = board[reel]?.[row];
    if (sym === 'xNudge') {
      const stack = getNudgeStackHost(reel)?.querySelector(
        ':scope > .xnudge-stack:not(.xnudge-strip-stack)'
      );
      if (stack) return stack;
    }
    const el = getSymbolEl(reel, row);
    if (el) return el;
    const content = getReelContent(reel);
    const symbols = content?.querySelectorAll('.symbol');
    if (!symbols?.length) return null;
    let domIdx = row;
    if (
      bonusMode &&
      reel === BONUS_EXPAND_REEL &&
      board[reel]?.length >= BONUS_EXPAND_ROWS &&
      !bonusReelExpanded
    ) {
      domIdx = row - BASE_REEL_ROWS[reel];
    }
    return symbols[domIdx] || null;
  }

  function collectBigWinPreludeTargets(highlights) {
    const seen = new Set();
    const targets = [];
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      targets.push(el);
    };

    for (const pos of highlights || []) {
      if (pos.torpedoSlot != null) {
        add(getTorpedoCells()[pos.torpedoSlot]);
        continue;
      }
      if (pos.reel == null || pos.row == null) continue;
      add(getWinHighlightTarget(pos.reel, pos.row));
    }
    return targets;
  }

  function applyBigWinPreludeHighlights(highlights) {
    const targets = collectBigWinPreludeTargets(highlights);
    for (const el of targets) {
      el.classList.add('bigwin-prelude-highlight');
    }
    return targets;
  }

  function clearBigWinPreludeMarks() {
    document
      .querySelectorAll('.bigwin-prelude-highlight, .bigwin-prelude-shaking')
      .forEach((el) => {
        el.style.transform = '';
        el.style.transition = '';
        el.classList.remove(
          'bigwin-prelude-highlight',
          'bigwin-prelude-shaking',
          'bigwin-shake-x'
        );
      });
  }

  /** Тряска выигрышных символов: амплитуда 0 → полная за время прелюдии. */
  function animateBigWinPreludeShake(durationMs, shakeEls, skipCtrl) {
    const els = shakeEls?.length ? shakeEls : collectBigWinPreludeTargets([]);
    if (!els.length) return Promise.resolve();

    const maxPx = BIG_WIN_PRELUDE_SHAKE_MAX_PX;
    const omega = BIG_WIN_PRELUDE_SHAKE_HZ * Math.PI * 2 * 0.001;

    for (const el of els) {
      el.classList.add('bigwin-prelude-shaking');
      el.style.transition = 'none';
    }

    const clearShake = () => {
      for (const el of els) {
        el.style.transform = '';
        el.style.transition = '';
        el.classList.remove('bigwin-prelude-shaking');
      }
      if (skipCtrl) skipCtrl.preludeShakeRaf = null;
    };

    return new Promise((resolve) => {
      const end = () => {
        if (skipCtrl) {
          if (skipCtrl.preludeShakeRaf) {
            cancelAnimationFrame(skipCtrl.preludeShakeRaf);
            skipCtrl.preludeShakeRaf = null;
          }
          skipCtrl._flushPreludeShake = null;
        }
        clearShake();
        resolve();
      };

      if (skipCtrl) skipCtrl._flushPreludeShake = end;

      const start = performance.now();
      const tick = (now) => {
        if (skipCtrl?.preludeSkip) {
          end();
          return;
        }

        const elapsed = now - start;
        const t = Math.min(elapsed / durationMs, 1);
        const amp = maxPx * t * t;
        const x = Math.sin(elapsed * omega) * amp;
        const tx = `${Math.round(x * 10) / 10}px`;

        for (const el of els) {
          el.style.transform = `translate3d(${tx}, 0, 0)`;
        }

        if (t < 1) {
          const raf = requestAnimationFrame(tick);
          if (skipCtrl) skipCtrl.preludeShakeRaf = raf;
        } else {
          end();
        }
      };
      const raf = requestAnimationFrame(tick);
      if (skipCtrl) skipCtrl.preludeShakeRaf = raf;
    });
  }

  async function playBigWinPrelude(highlights, skipCtrl) {
    if (skipCtrl) {
      skipCtrl.inPrelude = true;
      skipCtrl.preludeSkip = false;
    }
    const shakeTargets = applyBigWinPreludeHighlights(highlights);
    playSlotSound(SOUND_BAM);
    await sleepUnlessSkipped(BIG_WIN_PRELUDE_BAM_MS, skipCtrl, 'preludeSkip');

    if (!skipCtrl?.preludeSkip) {
      playSlotSound(SOUND_TRRR);
      await animateBigWinPreludeShake(BIG_WIN_PRELUDE_SHAKE_MS, shakeTargets, skipCtrl);
    }
    clearBigWinPreludeMarks();
    if (skipCtrl) skipCtrl.inPrelude = false;
  }

  function setBigWinCounterDisplay(mult, betAmt) {
    const amountEl = document.getElementById('bigWinAmount');
    const m = Math.max(0, Number(mult) || 0);
    if (amountEl) {
      amountEl.textContent = (m * betAmt).toFixed(2);
    }
    updateBigWinCounterScale(m);
  }

  function showBigWinNudgeBadge(mult) {
    const badge = document.getElementById('bigWinNudgeBadge');
    if (!badge || !(mult > 1)) return;
    const next = Math.round(mult);
    const changed = badge.hidden || badge.textContent !== `×${next}`;
    badge.textContent = `×${next}`;
    badge.hidden = false;
    badge.setAttribute('aria-hidden', 'false');
    if (changed) {
      badge.classList.remove('big-win-nudge-badge--bump');
      void badge.offsetWidth;
      badge.classList.add('big-win-nudge-badge--bump');
      playSlotSound(SOUND_BOOM);
    }
  }

  /** Какой × показывать при текущем значении счётчика (104×, nudge ×4 → 26→×2, 52→×3, 78→×4). */
  function getNudgeDisplayMultAtCounter(currentMult, totalMult, nudgeMult) {
    if (nudgeMult <= 1) return 0;
    const step = totalMult / nudgeMult;
    let display = 1;
    for (let k = 1; k < nudgeMult; k++) {
      if (currentMult >= k * step - 1e-6) display = k + 1;
    }
    return display >= 2 ? display : 0;
  }

  function buildCounterSegmentPoints(from, to, totalMult, nudgeMult) {
    const fromN = Number(from) || 0;
    const toN = Number(to) || 0;
    const points = [fromN];
    if (nudgeMult > 1 && toN > fromN + 1e-6) {
      const step = totalMult / nudgeMult;
      for (let k = 1; k < nudgeMult; k++) {
        const at = k * step;
        if (at > fromN + 1e-6 && at < toN - 1e-6) points.push(at);
      }
    }
    if (Math.abs(points[points.length - 1] - toN) > 1e-6) points.push(toN);
    return points;
  }

  function tryPlayWinOutAtFinalMark(counterMult, ctx) {
    const { totalMult, winOutPlayed } = ctx;
    if (!winOutPlayed || winOutPlayed.done) return;
    if (Math.abs((Number(counterMult) || 0) - totalMult) > 1e-4) return;
    winOutPlayed.done = true;
    playSlotSound(SOUND_WIN_OUT);
  }

  function updateNudgeBadgeForCounter(currentMult, totalMult, nudgeMult, badgeState) {
    const display = getNudgeDisplayMultAtCounter(
      currentMult,
      totalMult,
      nudgeMult
    );
    if (display >= 2 && display > badgeState.displayMult) {
      showBigWinNudgeBadge(display);
      badgeState.displayMult = display;
    }
  }

  function finishBigWinStageCounter(toN, betAmt, ctx) {
    const { totalMult, nudgeMult, badgeState } = ctx;
    setBigWinCounterDisplay(toN, betAmt);
    updateNudgeBadgeForCounter(toN, totalMult, nudgeMult, badgeState);
    tryPlayWinOutAtFinalMark(toN, ctx);
  }

  async function animateBigWinStageCounter(from, to, durationMs, betAmt, ctx, skipCtrl) {
    const { totalMult, nudgeMult, badgeState } = ctx;
    const fromN = Number(from) || 0;
    const toN = Number(to) || 0;
    const span = toN - fromN;

    if (skipCtrl) skipCtrl._stageToMult = toN;

    if (span <= 1e-6) {
      finishBigWinStageCounter(toN, betAmt, ctx);
      return;
    }

    updateNudgeBadgeForCounter(fromN, totalMult, nudgeMult, badgeState);

    const points = buildCounterSegmentPoints(fromN, toN, totalMult, nudgeMult);
    for (let i = 0; i < points.length - 1; i++) {
      if (skipCtrl?.stageSkip) {
        finishBigWinStageCounter(toN, betAmt, ctx);
        return;
      }
      const a = points[i];
      const b = points[i + 1];
      const segTime = durationMs * ((b - a) / span);
      await animateMultCounter(a, b, segTime, betAmt, skipCtrl);
      if (skipCtrl?.stageSkip) {
        finishBigWinStageCounter(toN, betAmt, ctx);
        return;
      }
      updateNudgeBadgeForCounter(b, totalMult, nudgeMult, badgeState);
      tryPlayWinOutAtFinalMark(b, ctx);
    }

    if (skipCtrl) skipCtrl._stageToMult = null;
  }

  function hideBigWinNudgeBadge() {
    const badge = document.getElementById('bigWinNudgeBadge');
    if (!badge) return;
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
  }

  function animateMultCounter(fromMult, toMult, durationMs, betAmt, skipCtrl) {
    const from = Math.max(0, Number(fromMult) || 0);
    const to = Math.max(from, Number(toMult) || 0);
    const ms = Math.max(1, Number(durationMs) || 1);

    return new Promise((resolve) => {
      const finish = (val) => {
        if (bigWinStageRaf) {
          cancelAnimationFrame(bigWinStageRaf);
          bigWinStageRaf = null;
        }
        if (skipCtrl) skipCtrl._flushStageAnim = null;
        setBigWinCounterDisplay(val, betAmt);
        resolve();
      };

      if (skipCtrl) {
        skipCtrl._flushStageAnim = () => {
          const val =
            skipCtrl.stageSkip && skipCtrl._stageToMult != null
              ? skipCtrl._stageToMult
              : to;
          finish(val);
        };
      }

      const start = performance.now();
      const tick = (now) => {
        if (skipCtrl?.stageSkip) {
          const val =
            skipCtrl._stageToMult != null ? skipCtrl._stageToMult : to;
          finish(val);
          return;
        }
        const t = Math.min(1, (now - start) / ms);
        const val = from + (to - from) * t;
        setBigWinCounterDisplay(val, betAmt);
        if (t < 1) {
          bigWinStageRaf = requestAnimationFrame(tick);
        } else {
          finish(to);
        }
      };
      bigWinStageRaf = requestAnimationFrame(tick);
    });
  }

  async function runBigWinStage(stage, betAmt, ctx, skipCtrl) {
    const overlay = document.getElementById('bigWinOverlay');
    const titleEl = document.getElementById('bigWinTitle');
    if (titleEl) titleEl.textContent = stage.title;
    if (overlay) overlay.classList.add('active');

    if (skipCtrl) {
      skipCtrl.resetStageSkip();
      skipCtrl.inStage = true;
    }

    stopBigWinAudio();
    bigWinActiveAudio = playSlotSound(SOUND_WIN);

    await animateBigWinStageCounter(
      stage.fromMult,
      stage.toMult,
      BIG_WIN_STAGE_MS,
      betAmt,
      ctx,
      skipCtrl
    );

    if (skipCtrl) {
      skipCtrl.inStage = false;
      skipCtrl._flushStageAnim = null;
    }
    stopBigWinAudio();
  }

  async function runBigWinSequence({ totalWin, bet: betAmt, highlights, nudgeMult }) {
    pauseBgMusic();
    try {
      await runBigWinSequenceInner({ totalWin, bet: betAmt, highlights, nudgeMult });
    } finally {
      resumeBgMusic();
    }
  }

  function getMaxWinCapAmount() {
    return MAX_WIN_CAP_MULT * bet;
  }

  function isJackpotBookEntry(entry) {
    if (!entry) return false;
    if (entry.isJackpot) return true;
    const jp = window.XbootBooks?.getStore?.()?.jackpotSeed || '';
    if (jp && entry.seed === jp) return true;
    if (
      Number(entry.totalWin) >= MAX_WIN_CAP_MULT
      && Number(entry.scatterCount) >= 4
      && (entry.bonusSpins?.length || 0) >= 7
    ) {
      return true;
    }
    return false;
  }

  function isMaxWinBookSession() {
    if (!activeBookSession) return false;
    if (activeBookSession.isJackpot) return true;
    return isJackpotBookEntry(activeBookSession.entry);
  }

  function isJackpotBookSession() {
    return isMaxWinBookSession();
  }

  function getBookSessionPaid() {
    return Math.max(0, Number(activeBookSession?.sessionPaid) || 0);
  }

  function capBookPayout(amount) {
    const cap = getMaxWinCapAmount();
    const room = Math.max(0, cap - getBookSessionPaid());
    return Math.min(Math.max(0, Number(amount) || 0), room);
  }

  async function settleBookWin(amount) {
    const pay = capBookPayout(amount);
    if (replayMode) {
      if (activeBookSession) {
        activeBookSession.sessionPaid = getBookSessionPaid() + pay;
      }
      return pay;
    }
    if (pay > 0) await settle(0, pay, { ...getWinSettleMeta(), skipBigWinRecord: true });
    if (activeBookSession) {
      activeBookSession.sessionPaid = getBookSessionPaid() + pay;
    }
    return pay;
  }

  /** Доплата до потолка 55 200× (остаток сессии). */
  async function settleMaxWinCapRemainder() {
    const cap = getMaxWinCapAmount();
    const remainder = Math.max(0, cap - getBookSessionPaid());
    if (remainder <= 0.001) return 0;
    await settle(0, remainder, { ...getWinSettleMeta(), skipBigWinRecord: true });
    if (activeBookSession) {
      activeBookSession.sessionPaid = cap;
    }
    return remainder;
  }

  function shouldTriggerMaxWinScene(spinWin, bonusWinBeforeSpin, opts = {}) {
    if (opts.jackpotFinal && isMaxWinBookSession()) return true;
    if (!activeBookSession) return false;
    const cap = getMaxWinCapAmount();
    const spin = Math.max(0, Number(spinWin) || 0);
    const base = Math.max(0, Number(activeBookSession.baseWin) || 0);
    const bonusBefore = Math.max(0, Number(bonusWinBeforeSpin) || 0);
    const sessionAfter = base + bonusBefore + spin;
    if (sessionAfter >= cap - 0.001 || spin >= cap - 0.001) return true;
    if (
      isMaxWinBookSession()
      && Number(activeBookSession.entry?.totalWin) >= MAX_WIN_CAP_MULT
    ) {
      return sessionAfter >= (activeBookSession.targetTotal || cap) - 0.001;
    }
    return false;
  }

  function stopMaxWinAudio() {
    for (const ref of [maxWinActiveAudio, maxWinLoopAudio]) {
      if (!ref) continue;
      try {
        ref.pause();
        ref.currentTime = 0;
        ref.loop = false;
      } catch {
        /* ignore */
      }
    }
    maxWinActiveAudio = null;
    maxWinLoopAudio = null;
  }

  function clearMaxWinDomState() {
    if (maxWinCounterRaf) {
      cancelAnimationFrame(maxWinCounterRaf);
      maxWinCounterRaf = null;
    }
    stopMaxWinAudio();
    document.querySelector('.game-wrap')?.classList.remove('maxwin-active');
    const overlay = document.getElementById('maxWinOverlay');
    const btn = document.getElementById('maxWinContinue');
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (btn) btn.hidden = true;
  }

  function setMaxWinCounterDisplay(mult, betAmt) {
    const amountEl = document.getElementById('maxWinAmount');
    const multEl = document.getElementById('maxWinMult');
    const m = Math.max(0, Number(mult) || 0);
    if (amountEl) amountEl.textContent = (m * betAmt).toFixed(2);
    if (multEl) multEl.textContent = `×${Math.round(m).toLocaleString('ru-RU')}`;
  }

  function animateMaxWinCounter(fromMult, toMult, durationMs, betAmt) {
    const from = Math.max(0, Number(fromMult) || 0);
    const to = Math.max(from, Number(toMult) || 0);
    const ms = Math.max(1, Number(durationMs) || 1);

    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const val = from + (to - from) * t;
        setMaxWinCounterDisplay(val, betAmt);
        if (t < 1) {
          maxWinCounterRaf = requestAnimationFrame(tick);
        } else {
          maxWinCounterRaf = null;
          setMaxWinCounterDisplay(to, betAmt);
          resolve();
        }
      };
      maxWinCounterRaf = requestAnimationFrame(tick);
    });
  }

  function runMaxWinScene() {
    return new Promise((resolve) => {
      pauseBgMusic();
      clearMaxWinDomState();

      const overlay = document.getElementById('maxWinOverlay');
      const btn = document.getElementById('maxWinContinue');
      const betAmt = Math.max(1e-6, Number(bet) || 1);

      document.querySelector('.game-wrap')?.classList.add('maxwin-active');

      if (overlay) {
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
      }
      if (btn) btn.hidden = true;

      setMaxWinCounterDisplay(0, betAmt);

      void (async () => {
        stopMaxWinAudio();
        maxWinActiveAudio = playSlotSound(SOUND_MAXWIN);
        await animateMaxWinCounter(0, MAX_WIN_CAP_MULT, MAX_WIN_COUNTER_MS, betAmt);
        stopMaxWinAudio();
        maxWinLoopAudio = playSlotSound(SOUND_MAXWIN2, { loop: true });

        if (btn) {
          btn.hidden = replayMode;
          const finishMaxWin = async () => {
            clearMaxWinDomState();
            clearBigWinPreludeMarks();
            clearWinPresentation();
            bonusTotalWin = 0;
            await exitBonusMode();
            if (!replayMode) resumeBgMusic();
            resolve();
          };
          if (replayMode) {
            setTimeout(() => {
              void finishMaxWin();
            }, 1800);
          } else {
            btn.hidden = false;
            const onContinue = () => {
              btn.removeEventListener('click', onContinue);
              void finishMaxWin();
            };
            btn.addEventListener('click', onContinue);
          }
        } else {
          await exitBonusMode();
          resumeBgMusic();
          resolve();
        }
      })();
    });
  }

  async function runBigWinSequenceInner({ totalWin, bet: betAmt, highlights, nudgeMult }) {
    clearBigWinDomState();

    const bet = Math.max(1e-6, Number(betAmt) || 1);
    const win = Math.max(0, Number(totalWin) || 0);
    const totalMult = win / bet;
    const nudge = Math.max(1, Number(nudgeMult) || 1);
    const stages = buildBigWinStages(totalMult);

    if (!stages.length) return;

    bigWinSkipCtrl = createBigWinSkipCtrl();
    bigWinSkipCtrl.begin();

    try {
      await playBigWinPrelude(highlights, bigWinSkipCtrl);

      const overlay = document.getElementById('bigWinOverlay');
      if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
      }
      hideBigWinNudgeBadge();
      bigWinCounterScaleState = { totalMult, scale: 1 };
      const amountEl = document.getElementById('bigWinAmount');
      if (amountEl) amountEl.style.transform = 'scale(1)';
      setBigWinCounterDisplay(stages[0].fromMult, bet);

      const ctx = {
        totalMult,
        nudgeMult: nudge,
        badgeState: { displayMult: 0 },
        winOutPlayed: { done: false }
      };

      for (let i = 0; i < stages.length; i++) {
        playSlotSound(SOUND_BOOM);
        await runBigWinStage(stages[i], bet, ctx, bigWinSkipCtrl);
      }

      bigWinSkipCtrl.inHold = true;
      bigWinSkipCtrl.holdSkip = false;
      await sleepUnlessSkipped(BIG_WIN_HOLD_AFTER_FINAL_MS, bigWinSkipCtrl, 'holdSkip');
      bigWinSkipCtrl.inHold = false;
    } finally {
      clearBigWinDomState();
    }
  }

  async function debugShowBigWin(winMult, nudgeMult = 1) {
    if (isSpinning) return;
    const mult = Math.max(BIG_WIN_MIN_MULT, Number(winMult) || BIG_WIN_MIN_MULT);
    const nudge = Math.max(1, Number(nudgeMult) || 1);
    const totalWin = bet * mult;
    const fakeHighlights = [];
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < getReelRows(r); row++) {
        fakeHighlights.push({ reel: r, row });
      }
    }
    isSpinning = true;
    syncControlsState();
    try {
      await runBigWinSequence({
        totalWin,
        bet,
        highlights: fakeHighlights,
        nudgeMult: nudge
      });
    } finally {
      isSpinning = false;
      syncControlsState();
    }
  }

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
    clearBigWinDomState();
    if (winCountBzzzAudio) {
      try {
        winCountBzzzAudio.pause();
        winCountBzzzAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
      winCountBzzzAudio = null;
    }
    document
      .querySelectorAll('.symbol.win-highlight, .torpedo-cell.win-highlight, .xnudge-stack.win-highlight')
      .forEach((el) => {
        el.classList.remove('win-highlight');
      });
    const overlay = document.getElementById('winOverlay');
    if (overlay) {
      overlay.classList.remove('exit');
      overlay.style.display = 'none';
    }
  }

  function applyWinHighlights(highlights) {
    for (const el of collectBigWinPreludeTargets(highlights)) {
      el.classList.add('win-highlight');
    }
  }

  function showWinPresentation(winInfo) {
    clearWinPresentation();

    const countEndPromise = new Promise((resolve) => {
      winOverlayCountEndResolve = resolve;
    });

    const targetWin = Number(winInfo.totalWin) || 0;
    const baseBet = Number(bet) || 1;
    const isBigWin = targetWin >= BIG_WIN_MIN_MULT * baseBet;

    if (!isBigWin) applyWinHighlights(winInfo.highlights);

    if (isBigWin) {
      runBigWinSequence({
        totalWin: targetWin,
        bet: baseBet,
        highlights: winInfo.highlights,
        nudgeMult: winInfo.peakNudgeMult || 1
      }).then(() => {
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

    if (!(overlay && overlayAmount && overlayLines)) {
      if (winOverlayCountEndResolve) {
        const r = winOverlayCountEndResolve;
        winOverlayCountEndResolve = null;
        r();
      }
      return countEndPromise;
    }

    overlayAmount.textContent = '0.00';
    overlayLines.textContent = `Ways: ${Math.round(winInfo.totalWays) || 0}`;
    overlay.style.display = 'flex';
    overlay.classList.remove('exit');
    playSlotSound(SOUND_WIN_DEFAULT);

    const holdZeroMs = 300;
    const countMs = 700;
    const stopWinCountBzzz = () => {
      if (!winCountBzzzAudio) return;
      try {
        winCountBzzzAudio.pause();
        winCountBzzzAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
      winCountBzzzAudio = null;
    };
    const holdFinalMs = 500;
    const exitMs = 600;

    winOverlayCountTimeout = setTimeout(() => {
      winOverlayCountTimeout = null;
      stopWinCountBzzz();
      winCountBzzzAudio = playSlotSound(SOUND_BZZZ, { loop: true });
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / countMs, 1);
        overlayAmount.textContent = (targetWin * t).toFixed(2);
        if (t < 1) {
          winOverlayCountRaf = requestAnimationFrame(tick);
        } else {
          winOverlayCountRaf = null;
          overlayAmount.textContent = targetWin.toFixed(2);
          stopWinCountBzzz();
          if (winOverlayCountEndResolve) {
            const r = winOverlayCountEndResolve;
            winOverlayCountEndResolve = null;
            r();
          }
          winOverlayExitTimeout = setTimeout(() => {
            winOverlayExitTimeout = null;
            overlay.classList.add('exit');
          }, holdFinalMs);
        }
      };
      winOverlayCountRaf = requestAnimationFrame(tick);
    }, holdZeroMs);

    winPresentationTimeout = setTimeout(() => {
      clearWinPresentation();
    }, holdZeroMs + countMs + holdFinalMs + exitMs);

    return countEndPromise;
  }

  function getTorpedoWrap() {
    return document.getElementById('torpedoWrap');
  }

  function getTorpedoCells() {
    return document.querySelectorAll('.torpedo-cell[data-torpedo-slot]');
  }

  function clearTorpedoCellDom(cell) {
    if (!cell) return;
    cell.replaceChildren();
    cell.classList.remove('torpedo-cell--filled');
  }

  function renderTorpedoSlotDom(slotIndex) {
    const cells = getTorpedoCells();
    const cell = cells[slotIndex];
    if (!cell) return;
    clearTorpedoCellDom(cell);
    const sym = torpedoSlots[slotIndex];
    if (!sym) return;
    cell.classList.add('torpedo-cell--filled');
    const piece = document.createElement('div');
    piece.className = 'torpedo-piece';
    piece.style.backgroundImage = `url(${symbolSrc(sym)})`;
    cell.appendChild(piece);
  }

  function syncTorpedoDom() {
    for (let i = 0; i < 4; i++) renderTorpedoSlotDom(i);
  }

  function hideTorpedoWrap() {
    const wrap = getTorpedoWrap();
    if (!wrap) return;
    wrap.hidden = true;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.classList.remove('torpedo-active', 'torpedo-visible', 'torpedo-exit');
    torpedoBarShown = false;
    if (isBonus4Mode()) updateResponsiveSlotSize();
  }

  function resetTorpedoState() {
    torpedoSlots = [null, null, null, null];
    torpedoDropRows = [null, null, null, null];
    torpedoResolved = null;
    torpedoBarShown = false;
    hideTorpedoWrap();
    getTorpedoCells().forEach((cell) => {
      clearTorpedoCellDom(cell);
      cell?.classList.remove('torpedo-cell--resolved', 'win-highlight', 'bigwin-prelude-highlight');
    });
  }

  async function showTorpedoIntro() {
    const wrap = getTorpedoWrap();
    if (!wrap) return;
    wrap.hidden = false;
    wrap.setAttribute('aria-hidden', 'false');
    wrap.classList.add('torpedo-active');
    wrap.classList.remove('torpedo-exit', 'torpedo-visible');
    syncTorpedoDom();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    wrap.classList.add('torpedo-visible');
    torpedoBarShown = true;
    updateResponsiveSlotSize();
    await sleep(TORPEDO_RISE_MS);
  }

  function getTorpedoCellCenter(slotIndex) {
    const cell = getTorpedoCells()[slotIndex];
    if (!cell) return { x: 0, y: 0 };
    const r = cell.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function getSymbolScreenCenter(reel, row) {
    const el = getSymbolEl(reel, row);
    if (!el) return getTorpedoCellCenter(torpedoSlotForReel(reel));
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  async function animateTorpedoFall(reel, row, sym, b, m) {
    const slot = torpedoSlotForReel(reel);
    if (slot < 0) return;

    const symEl = getSymbolEl(reel, row);
    const overlayEl = symEl?.querySelector('.symbol-bonus4-overlay');
    const fromRect = overlayEl
      ? overlayEl.getBoundingClientRect()
      : symEl
        ? symEl.getBoundingClientRect()
        : null;

    if (b) {
      b[reel][row] = 'wild4';
      m[reel][row] = 1;
    }
    if (symEl) setSymbolVisual(symEl, 'wild4', m?.[reel]?.[row] || 1);

    const cell = getTorpedoCells()[slot];
    if (!cell || !fromRect) {
      torpedoSlots[slot] = sym;
      torpedoDropRows[slot] = row;
      renderTorpedoSlotDom(slot);
      return;
    }

    const to = getTorpedoCellCenter(slot);
    const targetRect = cell.getBoundingClientRect();

    const fly = document.createElement('div');
    fly.className = 'torpedo-fly';
    fly.style.backgroundImage = `url(${symbolSrc(sym)})`;
    fly.style.width = `${fromRect.width}px`;
    fly.style.height = `${fromRect.height}px`;
    fly.style.left = `${fromRect.left}px`;
    fly.style.top = `${fromRect.top}px`;
    document.body.appendChild(fly);

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    fly.style.width = `${targetRect.width}px`;
    fly.style.height = `${targetRect.height}px`;
    fly.style.left = `${to.x - targetRect.width / 2}px`;
    fly.style.top = `${to.y - targetRect.height / 2}px`;
    await sleep(TORPEDO_FALL_MS);

    torpedoSlots[slot] = sym;
    torpedoDropRows[slot] = row;
    fly.classList.remove('torpedo-fly');
    fly.classList.add('torpedo-piece');
    fly.style.position = 'absolute';
    fly.style.inset = '0';
    fly.style.left = '0';
    fly.style.top = '0';
    fly.style.width = '100%';
    fly.style.height = '100%';
    fly.style.transition = 'none';
    cell.classList.add('torpedo-cell--filled');
    cell.appendChild(fly);
  }

  async function animateTorpedoExit() {
    const wrap = getTorpedoWrap();
    if (!wrap) return;
    wrap.classList.add('torpedo-exit');
    wrap.classList.remove('torpedo-visible');
    await sleep(TORPEDO_EXIT_MS);
    hideTorpedoWrap();
    torpedoSlots = [null, null, null, null];
    torpedoDropRows = [null, null, null, null];
    torpedoResolved = null;
    getTorpedoCells().forEach((cell) => {
      clearTorpedoCellDom(cell);
      cell?.classList.remove('torpedo-cell--resolved', 'win-highlight', 'bigwin-prelude-highlight');
    });
  }

  function updateTorpedoResolvedPiece(slotIndex, sym, mult) {
    const cell = getTorpedoCells()[slotIndex];
    if (!cell) return;
    let piece = cell.querySelector('.torpedo-piece');
    if (!piece) {
      piece = document.createElement('div');
      piece.className = 'torpedo-piece';
      cell.appendChild(piece);
    }
    cell.classList.add('torpedo-cell--filled', 'torpedo-cell--resolved');
    piece.style.backgroundImage = `url(${symbolSrc(sym)})`;
    piece.querySelector('.torpedo-mult')?.remove();
    if (mult > 1) {
      const badge = document.createElement('span');
      badge.className = 'torpedo-mult';
      badge.textContent = `x${mult}`;
      cell.appendChild(badge);
    }
  }

  function resolveTorpedoForPayout() {
    const xwReplacement = PAYABLE[Math.floor(Math.random() * PAYABLE.length)];
    const resolved = [null, null, null, null];
    for (let slot = 0; slot < BONUS4_TORPEDO_REELS.length; slot++) {
      const torpedoSym = torpedoSlots[slot];
      if (!torpedoSym) continue;
      const reel = BONUS4_TORPEDO_REELS[slot];
      let sym;
      const mult = 2;
      if (torpedoSym === 'xways4') sym = xwReplacement;
      else if (torpedoSym === 'xwild4') sym = 'wild';
      else continue;
      resolved[slot] = { sym, mult, reel };
      updateTorpedoResolvedPiece(slot, sym, mult);
    }
    torpedoResolved = resolved;
    return resolved;
  }

  async function animateTorpedoCompleteOnLane() {
    resolveTorpedoForPayout();
    playSlotSound(SOUND_XWAYS);
    await sleep(TORPEDO_RESOLVE_MS);
  }

  function applyBookTorpedoLandingBoard(b, m, drops) {
    if (!drops?.length) return;
    for (const drop of drops) {
      const reel = Number(drop.reel);
      const row = Number(drop.row);
      const sym = drop.sym;
      if (!sym || reel < 0 || row < 0 || !b[reel]) continue;
      b[reel][row] = sym;
      if (m[reel]) m[reel][row] = 1;
    }
  }

  function applyTorpedoResolvedFromBook(resolved) {
    if (!Array.isArray(resolved)) return;
    torpedoResolved = resolved.map((entry) =>
      entry ? { sym: entry.sym, mult: Number(entry.mult) || 2, reel: entry.reel } : null
    );
    for (let slot = 0; slot < torpedoResolved.length; slot++) {
      const entry = torpedoResolved[slot];
      if (entry) updateTorpedoResolvedPiece(slot, entry.sym, entry.mult);
    }
  }

  async function replayBookTorpedoDrops(b, m, drops, preset) {
    for (const drop of drops) {
      playSlotSound(SOUND_WAYS);
      await animateTorpedoFall(drop.reel, drop.row, drop.sym, b, m);
    }
    const full = !!preset?.torpedoComplete || torpedoIsFull();
    if (full && preset?.torpedoResolved) {
      applyTorpedoResolvedFromBook(preset.torpedoResolved);
      playSlotSound(SOUND_XWAYS);
      await sleep(TORPEDO_RESOLVE_MS);
    }
    return full;
  }

  async function processBonus4TorpedoDrops(b, m) {
    const drops = [];
    for (const reel of BONUS4_TORPEDO_REELS) {
      if (torpedoReelBlocked(reel)) continue;
      for (let row = 0; row < getReelRows(reel); row++) {
        const sym = b[reel][row];
        if (sym === 'xways4' || sym === 'xwild4') {
          drops.push({ reel, row, sym });
          break;
        }
      }
    }
    for (const d of drops) {
      playSlotSound(SOUND_WAYS);
      await animateTorpedoFall(d.reel, d.row, d.sym, b, m);
    }
    return torpedoIsFull();
  }

  function applyBonusLayout() {
    activeReelRows = bonusMode
      ? BASE_REEL_ROWS.map((rows, i) =>
          i === BONUS_EXPAND_REEL && bonusReelExpanded ? BONUS_EXPAND_ROWS : rows
        )
      : BASE_REEL_ROWS.slice();
    for (let r = 0; r < NUM_REELS; r++) {
      const col = getReelCol(r);
      const viewport = getReelViewport(r);
      if (!col || !viewport) continue;
      viewport.style.setProperty('--rows', String(getReelRows(r)));
      col.classList.toggle(
        'reel-col--expanded',
        bonusMode && bonusReelExpanded && r === BONUS_EXPAND_REEL
      );
      col.classList.toggle(
        'has-xnudge-lane',
        reelHasXNudgeLane(r)
      );
      col.classList.toggle(
        'reel-col--grow-up',
        bonusMode && bonusReelExpanded && r === BONUS_EXPAND_REEL
      );
    }
  }

  function expandBoardForBonus(b, m) {
    const reel = BONUS_EXPAND_REEL;
    const base = BASE_REEL_ROWS[reel];
    const rows = BONUS_EXPAND_ROWS;
    if (b[reel].length >= rows) return;

    const bottomSyms = b[reel].slice(0, base);
    const bottomM = m[reel].slice(0, base);
    const topSyms = [];
    const topM = [];
    while (topSyms.length + bottomSyms.length < rows) {
      topSyms.push(pickRandomSymbol(reel, { bonus: true, omitScatter: true }));
      topM.push(1);
    }
    b[reel] = [...topSyms, ...bottomSyms];
    m[reel] = [...topM, ...bottomM];
  }

  function stopBonusEntryMusic() {
    if (bonusEntryLoopTimeoutId != null) {
      clearTimeout(bonusEntryLoopTimeoutId);
      bonusEntryLoopTimeoutId = null;
    }
    if (!bonusEntryMusicAudio) return;
    try {
      bonusEntryMusicAudio.pause();
      bonusEntryMusicAudio.currentTime = 0;
      bonusEntryMusicAudio.loop = false;
    } catch {
      /* ignore */
    }
    bonusEntryMusicAudio = null;
  }

  function stopBonusEndSounds() {
    for (const id of bonusEndSoundTimeouts) clearTimeout(id);
    bonusEndSoundTimeouts = [];
    if (bonusEndCounterRaf != null) {
      cancelAnimationFrame(bonusEndCounterRaf);
      bonusEndCounterRaf = null;
    }
    if (bonusEndMusicAudio) {
      try {
        bonusEndMusicAudio.pause();
        bonusEndMusicAudio.currentTime = 0;
        bonusEndMusicAudio.loop = false;
      } catch {
        /* ignore */
      }
      bonusEndMusicAudio = null;
    }
    if (bonusEndBzzzAudio) {
      try {
        bonusEndBzzzAudio.pause();
        bonusEndBzzzAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
      bonusEndBzzzAudio = null;
    }
  }

  function animateBonusEndCounter(toAmount, durationMs, onUpdate) {
    const to = Math.max(0, Number(toAmount) || 0);
    const ms = Math.max(1, Number(durationMs) || 1);

    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / ms);
        onUpdate(to * t);
        if (t < 1) {
          bonusEndCounterRaf = requestAnimationFrame(tick);
        } else {
          bonusEndCounterRaf = null;
          onUpdate(to);
          resolve();
        }
      };
      bonusEndCounterRaf = requestAnimationFrame(tick);
    });
  }

  function showBonus3EndModal(totalWin) {
    return new Promise((resolve) => {
      const modal = document.getElementById('bonusModal');
      const titleEl = document.getElementById('bonusTitle');
      const descEl = document.getElementById('bonusDescription');
      const btn = document.getElementById('bonusContinueBtn');
      if (!modal || !btn) {
        resolve();
        return;
      }

      stopBonusEndSounds();
      stopBonusEntryMusic();
      pauseBgMusic();

      const amount = Math.max(0, Number(totalWin) || 0);
      titleEl.textContent = 'Бонус завершён';
      descEl.textContent = 'Общий выигрыш: 0.00';
      modal.hidden = false;

      playSlotSound(SOUND_BONUS3_END);
      bonusEndSoundTimeouts.push(
        setTimeout(() => {
          playSlotSound(SOUND_BONUS3_END_2);
        }, BONUS3_END_TO_END2_MS)
      );
      bonusEndSoundTimeouts.push(
        setTimeout(() => {
          bonusEndMusicAudio = playSlotSound(SOUND_BONUS3_END_LOOP, { loop: true });
          bonusEndBzzzAudio = playSlotSound(SOUND_BZZZ, { loop: true });
          void animateBonusEndCounter(amount, BONUS3_END_COUNTER_MS, (v) => {
            if (descEl) descEl.textContent = `Общий выигрыш: ${v.toFixed(2)}`;
          }).finally(() => {
            if (bonusEndBzzzAudio) {
              try {
                bonusEndBzzzAudio.pause();
                bonusEndBzzzAudio.currentTime = 0;
              } catch {
                /* ignore */
              }
              bonusEndBzzzAudio = null;
            }
            if (replayMode) {
              stopBonusEndSounds();
              modal.hidden = true;
              resolve();
            }
          });
        }, BONUS3_END_TO_END2_MS + BONUS3_END2_TO_LOOP_MS)
      );

      if (replayMode) return;

      const onClick = () => {
        btn.removeEventListener('click', onClick);
        stopBonusEndSounds();
        modal.hidden = true;
        resolve();
      };
      btn.addEventListener('click', onClick);
    });
  }

  function showBonusModal(title, description) {
    return new Promise((resolve) => {
      const modal = document.getElementById('bonusModal');
      const titleEl = document.getElementById('bonusTitle');
      const descEl = document.getElementById('bonusDescription');
      const btn = document.getElementById('bonusContinueBtn');
      if (!modal || !btn) {
        resolve();
        return;
      }
      titleEl.textContent = title;
      descEl.textContent = description;
      modal.hidden = false;
      if (replayMode) {
        setTimeout(() => {
          stopBonusEntryMusic();
          modal.hidden = true;
          resolve();
        }, 1400);
        return;
      }
      const onClick = () => {
        btn.removeEventListener('click', onClick);
        stopBonusEntryMusic();
        modal.hidden = true;
        resolve();
      };
      btn.addEventListener('click', onClick);
    });
  }

  function showBonusEntryModal(scatterCount) {
    stopBgMusic();
    playSlotSound(SOUND_BONUS3);
    stopBonusEntryMusic();
    bonusEntryLoopTimeoutId = setTimeout(() => {
      bonusEntryLoopTimeoutId = null;
      bonusEntryMusicAudio = playSlotSound(SOUND_BONUS3_LOOP, { loop: true });
    }, BONUS_ENTRY_LOOP_DELAY_MS);

    const desc =
      scatterCount >= 4
        ? `${freeSpinsRemaining} фриспинов · торпеда xWays / xWild`
        : `${freeSpinsRemaining} фриспинов · барабан 3 → ${BONUS_EXPAND_ROWS} символов`;

    return showBonusModal(`${scatterCount} SCATTER`, desc).finally(() => {
      stopBonusEntryMusic();
    });
  }

  async function showTargetResolve(hit) {
    const overlay = document.getElementById('targetOverlay');
    const resultEl = document.getElementById('targetResultText');
    if (!overlay || !resultEl) return;
    await sleep(TARGET_RESULT_DELAY_MS);
    overlay.hidden = false;
    resultEl.textContent = hit ? 'ПОПАДАНИЕ' : 'МИМО';
    resultEl.classList.toggle('target-result--hit', hit);
    resultEl.classList.toggle('target-result--miss', !hit);
    await sleep(hit ? 1400 : 1800);
    overlay.hidden = true;
    resultEl.classList.remove('target-result--hit', 'target-result--miss');
  }

  async function animateTargetMiss(b, m, targetRow) {
    await showTargetResolve(false);
    const reel = BONUS_EXPAND_REEL;
    bonusTargetNudgeArtReel = false;
    playSlotSound(SOUND_NUDGE_SWAP);
    b[reel][targetRow] = 'wild';
    renderReelStrip(reel, b[reel], m[reel]);
    await sleep(300);
  }

  function findTargetOnBoard(b) {
    const rows = getReelRows(BONUS_EXPAND_REEL);
    for (let row = 0; row < rows; row++) {
      if (b[BONUS_EXPAND_REEL][row] === 'target') return row;
    }
    return -1;
  }

  function releaseBonusTailHold(tailHold) {
    if (!tailHold || tailHold.released) return;
    tailHold.released = true;
    tailHold.releasedAt = performance.now();
  }

  async function animateBonusTargetNudgeHit(b, m, targetRow, targetMult) {
    const reel = BONUS_EXPAND_REEL;
    bonusTargetNudgeArtReel = true;
    for (let row = 0; row <= targetRow; row++) b[reel][row] = 'xNudge';
    renderReelStrip(reel, b[reel], m[reel]);

    await animateNudgeStepPushes(reel, b, m[reel], targetMult);
    await swapNudgeReelToWild(reel, b, m[reel]);
    await sleep(220);
  }

  async function resolveBonusTarget(b, m, tailHold = null) {
    const targetRow = findTargetOnBoard(b);
    if (targetRow < 0) return;

    const chancePct = randomInt(10, 75);
    const hit = Math.random() * 100 < chancePct;

    if (!hit) {
      await animateTargetMiss(b, m, targetRow);
      releaseBonusTailHold(tailHold);
      return;
    }

    await showTargetResolve(true);
    const rows = getReelRows(BONUS_EXPAND_REEL);
    const targetMult = rows - targetRow;
    await animateBonusTargetNudgeHit(b, m, targetRow, targetMult);
    releaseBonusTailHold(tailHold);
  }

  async function resolveBonusTargetFromBook(b, m, targetNudge, tailHold = null) {
    const targetRow = findTargetOnBoard(b);
    if (targetRow < 0) {
      releaseBonusTailHold(tailHold);
      return;
    }

    const reel = BONUS_EXPAND_REEL;
    const targetMult = Math.max(1, Number(targetNudge?.[reel]) || 1);
    const hit = targetMult > 1;

    if (!hit) {
      await animateTargetMiss(b, m, targetRow);
      releaseBonusTailHold(tailHold);
      return;
    }

    await showTargetResolve(true);
    await animateBonusTargetNudgeHit(b, m, targetRow, targetMult);
    releaseBonusTailHold(tailHold);
  }

  async function enterBonusMode(scatterCount, startBoard = null, startMults = null) {
    bonusMode = true;
    bonusReelExpanded = false;
    bonusEntryScatterCount = scatterCount;
    bonusTargetNudgeArtReel = false;
    setBonus4UiActive(scatterCount >= 4);
    if (scatterCount < 4) resetTorpedoState();
    freeSpinsRemaining = scatterCount >= 4 ? BONUS_SPINS_FOR_4 : BONUS_SPINS_FOR_3;
    bonusTotalWin = 0;
    applyBonusLayout();
    if (startBoard && startMults) {
      board = startBoard.map((col) => [...col]);
      mults = startMults.map((col) => [...col]);
      if (scatterCount < 4) expandBoardForBonus(board, mults);
    } else {
      initBoard();
      if (scatterCount < 4) expandBoardForBonus(board, mults);
    }
    buildReelsDom();
    updateResponsiveSlotSize();
    updateBonusHud();
    syncControlsState();
  }

  async function animateBonusReelExpand() {
    if (!bonusMode || bonusReelExpanded) return;

    const reel = BONUS_EXPAND_REEL;
    const col = getReelCol(reel);
    const viewport = getReelViewport(reel);
    const content = getReelContent(reel);
    if (!col || !viewport || !content) {
      bonusReelExpanded = true;
      applyBonusLayout();
      return;
    }

    expandBoardForBonus(board, mults);

    const fromRows = BASE_REEL_ROWS[reel];
    const toRows = BONUS_EXPAND_ROWS;

    bonusReelExpanded = true;
    activeReelRows[reel] = toRows;
    applyBonusLayout();
    updateResponsiveSlotSize();
    renderBoard(board, mults);
    const h = getSymbolHeight();
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

    col.classList.add('reel-col--grow-up', 'reel-col--expanding');
    viewport.style.setProperty('--rows', String(fromRows));

    renderBonusReelFullStrip(reel, board[reel], mults[reel], fromRows * h);
    forceReflowStrip(viewport);
    col.classList.add('reel-col--expanded', 'has-xnudge-lane');

    if (!col.querySelector('.reel-nudge-mult')) {
      const badge = document.createElement('div');
      badge.className = 'reel-nudge-mult';
      badge.setAttribute('aria-hidden', 'true');
      col.appendChild(badge);
    }

    viewport.style.transition = `height ${BONUS_EXPAND_ANIM_MS}ms ${ease}`;
    content.style.transition = `transform ${BONUS_EXPAND_ANIM_MS}ms ${ease}`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        viewport.style.setProperty('--rows', String(toRows));
        reelTransformY(content, 0);
      });
    });

    await sleep(BONUS_EXPAND_ANIM_MS);
    viewport.style.transition = '';
    content.style.transition = 'none';
    col.classList.remove('reel-col--expanding');
    renderReelStrip(reel, board[reel], mults[reel], 0);
    applyBonusLayout();
    refreshSymbolHeightCache();
    updateResponsiveSlotSize();
    await sleep(180);
  }

  async function animateBonusReelCollapse() {
    if (!bonusMode || !bonusReelExpanded) return;

    const reel = BONUS_EXPAND_REEL;
    const col = getReelCol(reel);
    const viewport = getReelViewport(reel);
    const content = getReelContent(reel);
    if (!col || !viewport || !content) {
      bonusReelExpanded = false;
      return;
    }

    const fromRows = BONUS_EXPAND_ROWS;
    const toRows = BASE_REEL_ROWS[reel];
    const h = getSymbolHeight();
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const hideRows = fromRows - toRows;

    col.classList.add('reel-col--grow-up', 'reel-col--collapsing');
    viewport.style.transition = `height ${BONUS_EXPAND_ANIM_MS}ms ${ease}`;
    content.style.transition = `transform ${BONUS_EXPAND_ANIM_MS}ms ${ease}`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        viewport.style.setProperty('--rows', String(toRows));
        reelTransformY(content, hideRows * h);
      });
    });

    await sleep(BONUS_EXPAND_ANIM_MS);

    bonusReelExpanded = false;
    activeReelRows[reel] = toRows;
    renderReelStrip(reel, board[reel], mults[reel], 0);
    content.style.transition = 'none';
    viewport.style.transition = '';
    col.classList.remove(
      'reel-col--expanded',
      'reel-col--grow-up',
      'has-xnudge-lane',
      'reel-col--collapsing'
    );
    const badge = col.querySelector('.reel-nudge-mult');
    if (badge) badge.remove();

    applyBonusLayout();
    refreshSymbolHeightCache();
    updateResponsiveSlotSize();
    renderBoard(board, mults);
    await sleep(160);
  }

  async function exitBonusMode() {
    stopBonusEndSounds();
    bonusPlaybackSpinsRef = null;
    bonusPlaybackSpinIdx = 0;
    activeBookSession = null;
    bonusMode = false;
    bonusReelExpanded = false;
    bonusEntryScatterCount = 0;
    bonusTargetNudgeArtReel = false;
    setBonus4UiActive(false);
    resetTorpedoState();
    freeSpinsRemaining = 0;
    setTargetTeaseActive(false);
    setTargetPreludeActive(false);
    stopTargetPreludeSound();
    applyBonusLayout();
    initBoard();
    buildReelsDom();
    updateResponsiveSlotSize();
    resetAllReelNudgeDisplays();
    updateBonusHud();
    syncControlsState();
    startBgMusic(SOUND_MAIN);
  }

  function updateBooksDebugHud(extra = '') {
    const el = document.getElementById('modBooksStatus');
    if (!el) return;
    const store = window.XbootBooks?.getStore?.();
    if (!store?.ready) {
      el.textContent = extra || 'Книги не загружены. npm run xboot-books';
      return;
    }
    const q = (store.queuedSeed || '').trim();
    const meta = store.meta || {};
    const b3 = store.buy3?.ready ? `${store.buy3.bookCount.toLocaleString('ru-RU')} buy3` : 'buy3 ✗';
    const b4 = store.buy4?.ready ? `${store.buy4.bookCount.toLocaleString('ru-RU')} buy4` : 'buy4 ✗';
    el.textContent =
      `${store.bookCount.toLocaleString('ru-RU')} база`
      + (meta.rtp != null ? ` · RTP ${meta.rtp}%` : '')
      + ` · ${b3} · ${b4}`
      + (q ? ` · очередь: ${q}` : '')
      + (extra ? ` · ${extra}` : '');
  }

  async function applyUrlBookQueue() {
    const qs = new URLSearchParams(location.search);
    const seed = (qs.get('bookSeed') || qs.get('seed') || '').trim();
    const idxRaw = qs.get('bookIndex') ?? qs.get('bookLine') ?? qs.get('book');
    if (qs.get('jackpot') === '1' || qs.get('testJackpot') === '1') {
      if (await queueJackpotBook()) return;
    }
    if (seed && (await window.XbootBooks?.queueSeed(seed))) {
      updateBooksDebugHud('из URL');
      return;
    }
    if (idxRaw != null && idxRaw !== '' && (await window.XbootBooks?.queueSeed(idxRaw))) {
      updateBooksDebugHud(`строка #${idxRaw}`);
    }
  }

  function applyBookSpinPreset(spin, reelRows) {
    const rows = reelRows || activeReelRows.slice();
    return window.XbootBooks.spinPresetToBoard(spin, rows, SYMBOLS);
  }

  function applyBookReelNudgeDisplays(nudgeMults) {
    reelNudgeMult = (nudgeMults || [1, 1, 1, 1, 1, 1]).slice();
    resetAllReelNudgeDisplays();
    for (let r = 0; r < NUM_REELS; r++) {
      if (reelHasXNudgeLane(r)) {
        updateReelNudgeMultDisplay(r, reelNudgeMult[r] || 1);
      }
    }
  }

  /** Книга хранит wild на nudge-барабане; для анимации — полная стопка xNudge. */
  function reelIsNudgeResolvedWildColumn(symbols) {
    if (!symbols?.length) return false;
    return symbols.every((sym) => sym === 'wild' || sym === 'wild4');
  }

  function bookSpinNeedsNudgeAnim(b, targetNudge) {
    if (boardHasXNudgeStacks(b)) return true;
    if (targetNudge?.length && getActiveXNudgeReels().some((r) => (targetNudge[r] || 1) > 1)) {
      return true;
    }
    return getActiveXNudgeReels().some((r) => reelIsNudgeResolvedWildColumn(b[r]));
  }

  function bookHasNudgeAnimTarget(targetNudge) {
    if (!targetNudge?.length) return false;
    return getActiveXNudgeReels().some((r) => (targetNudge[r] || 1) > 1);
  }

  function cellIsNudgeResolvedSym(sym) {
    return sym === 'wild' || sym === 'wild4' || sym === 'xNudge';
  }

  /** Книга хранит финал (wild + ×N); для анимации — один xNudge на стартовом ряду по ×N. */
  function prepareBookBoardForNudgeAnim(b, targetNudge) {
    for (const reel of getActiveXNudgeReels()) {
      const target = Math.max(1, Number(targetNudge[reel]) || 1);
      const rows = getReelRows(reel);
      if (target <= 1) {
        if (reelIsNudgeResolvedWildColumn(b[reel])) {
          for (let row = 0; row < rows; row++) b[reel][row] = 'xNudge';
        }
        continue;
      }
      const landRow = bookNudgeLandRow(rows, target);
      for (let row = 0; row < rows; row++) {
        if (row === landRow) b[reel][row] = 'xNudge';
        else {
          b[reel][row] = pickRandomSymbol(reel, { bonus: bonusMode, omitScatter: true });
        }
      }
    }
  }

  function bookTargetCeremonyIsHit(targetNudge) {
    return (Number(targetNudge?.[BONUS_EXPAND_REEL]) || 1) > 1;
  }

  /** Match на 1–2 барабанах + попадание (×N) или промах (1 wild в книге). */
  function bookHasTargetCeremony(bookBoard, targetNudge) {
    if (!isBonus3Mode() || !bonusReelExpanded) return false;
    if (!getFirstTwoReelsMatchSymbols(bookBoard).length) return false;
    const reel = BONUS_EXPAND_REEL;
    if (bookTargetCeremonyIsHit(targetNudge)) return true;
    const wilds = bookBoard[reel].filter((s) => s === 'wild' || s === 'wild4').length;
    return wilds === 1;
  }

  /** Книга хранит финал; перед спином восстанавливаем TARGET на 3-м барабане. */
  function prepareBookTargetBoardForAnim(b, targetNudge, bookBoard) {
    const reel = BONUS_EXPAND_REEL;
    const rows = getReelRows(reel);
    const targetMult = Math.max(1, Number(targetNudge[reel]) || 1);
    let targetRow;
    if (targetMult > 1) {
      targetRow = rows - targetMult;
    } else {
      targetRow = bookBoard[reel].findIndex((s) => s === 'wild' || s === 'wild4');
      if (targetRow < 0) targetRow = randomInt(0, rows - 1);
    }
    if (targetRow < 0 || targetRow >= rows) return false;
    const isMiss = targetMult <= 1;
    for (let row = 0; row < rows; row++) {
      if (row === targetRow) {
        b[reel][row] = 'target';
      } else if (isMiss) {
        b[reel][row] = bookBoard[reel][row];
      } else {
        b[reel][row] = pickRandomSymbol(reel, { bonus: true, omitScatter: true });
      }
    }
    return true;
  }

  function beginBookNudgeAnimState(b, targetNudge, bookBoard) {
    reelNudgeMult = [1, 1, 1, 1, 1, 1];
    resetAllReelNudgeDisplays();
    const ceremony = bookHasTargetCeremony(bookBoard || b, targetNudge);
    if (!bookSpinNeedsNudgeAnim(b, targetNudge) && !ceremony) {
      applyBookReelNudgeDisplays(targetNudge);
    }
  }

  function applyBookNudgeMultsForPayout(targetNudge) {
    if (!targetNudge?.length) return;
    applyBookReelNudgeDisplays(targetNudge);
  }

  function setupBookSpinFromPreset(applied) {
    const targetNudge = (applied.reelNudgeMult || [1, 1, 1, 1, 1, 1]).slice();
    const bookBoard = applied.board.map((col) => [...col]);
    const b = bookBoard.map((col) => [...col]);
    const m = applied.mults.map((col) => [...col]);
    const targetCeremony = bookHasTargetCeremony(bookBoard, targetNudge);
    beginBookNudgeAnimState(b, targetNudge, bookBoard);
    if (bookSpinNeedsNudgeAnim(b, targetNudge)) {
      prepareBookBoardForNudgeAnim(b, targetNudge);
    }
    return {
      b,
      m,
      raw: b.map((col) => [...col]),
      bookTargetNudge: targetNudge,
      bookBoard,
      needsBookNudge: bookSpinNeedsNudgeAnim(b, targetNudge)
    };
  }

  function restoreBookBoardForNudgeAnim(b, m, targetNudge) {
    if (!bookHasNudgeAnimTarget(targetNudge)) return false;
    prepareBookBoardForNudgeAnim(b, targetNudge);
    for (const reel of getActiveXNudgeReels()) {
      if ((targetNudge[reel] || 1) <= 1) continue;
      reelNudgeMult[reel] = 1;
      updateReelNudgeMultDisplay(reel, 1);
      renderReelStrip(reel, b[reel], m[reel]);
    }
    return true;
  }

  async function animateXNudgeMultOnlyStep(reel, mult) {
    playSlotSound(SOUND_NUDGE_BAM);
    bumpReelNudgeMultDisplay(reel);
    updateReelNudgeMultDisplay(reel, mult);
    await sleep(200);
  }

  async function swapNudgeReelToWild(reel, b, mRow) {
    const rows = getReelRows(reel);
    playSlotSound(SOUND_NUDGE_SWAP);
    for (let row = 0; row < rows; row++) {
      b[reel][row] = 'wild';
      mRow[row] = 1;
    }

    const content = getReelContent(reel);
    const host = getNudgeStackHost(reel);
    const drum = getReelDrum(reel);
    const view = getReelStripView(reel, b[reel], mRow);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < view.symbols.length; i++) {
      frag.appendChild(
        cloneStripSymbol(view.symbols[i], view.mults[i] || 1, view.symbols)
      );
    }

    if (content) {
      content.querySelector('.xnudge-strip-stack')?.remove();
      content.replaceChildren(frag);
      reelTransformY(content, 0);
      content.style.transition = 'none';
    }

    host?.querySelectorAll('.xnudge-stack').forEach((el) => el.remove());
    getReelViewport(reel)?.querySelectorAll('.xnudge-stack').forEach((el) => el.remove());

    if (drum) {
      reelTransformY(drum, 0);
      drum.classList.remove('nudge-drum-pushing');
      setStripCompositing(drum, false);
    }
    setStripCompositing(content, false);

    await sleep(280);
  }

  async function animateXNudgeToBookTarget(b, m, targetNudge) {
    const stacks = [];
    for (const reel of getActiveXNudgeReels()) {
      const targetMult = Math.max(1, Number(targetNudge[reel]) || 1);
      const landInfo = getXNudgeLandInfo(b[reel]);
      if (targetMult <= 1 && !landInfo) continue;
      stacks.push({
        reel,
        targetMult,
        landInfo
      });
    }
    if (!stacks.length) return;

    for (const { reel, targetMult, landInfo: stackLandInfo } of stacks) {
      const rows = getReelRows(reel);
      reelNudgeMult[reel] = 1;
      updateReelNudgeMultDisplay(reel, 1);

      let landInfo = stackLandInfo;
      if (targetMult > 1 && !landInfo) {
        const landRow = bookNudgeLandRow(rows, targetMult);
        for (let row = 0; row < rows; row++) {
          if (row === landRow) b[reel][row] = 'xNudge';
          else {
            b[reel][row] = pickRandomSymbol(reel, {
              bonus: bonusMode,
              omitScatter: true
            });
          }
        }
        landInfo = getXNudgeLandInfo(b[reel]);
      }

      if (targetMult <= 1) {
        renderReelStrip(reel, b[reel], m[reel]);
        await sleep(400);
        await swapNudgeReelToWild(reel, b, m[reel]);
        continue;
      }

      renderReelStrip(reel, b[reel], m[reel]);
      await sleep(400);

      await animateNudgeStepPushes(reel, b, m[reel], targetMult, {
        collapseDropped: true
      });

      await swapNudgeReelToWild(reel, b, m[reel]);
    }
  }

  async function runBookNudgeAnimation(b, m, bookTargetNudge) {
    if (!bookHasNudgeAnimTarget(bookTargetNudge) && !boardHasXNudgeStacks(b)) return;
    await animateXNudgeToBookTarget(b, m, bookTargetNudge);
    applyBookNudgeMultsForPayout(bookTargetNudge);
  }

  async function playMaxWinPrelude(highlights) {
    applyWinHighlights(highlights);
    playSlotSound(SOUND_BAM);
    await sleep(BIG_WIN_PRELUDE_BAM_MS);
  }

  async function resolveBookForSpin(scatterGuarantee) {
    const store = window.XbootBooks?.getStore?.();
    if (!store?.ready) return null;

    const queued = window.XbootBooks.consumeQueued();
    if (queued) return queued;

    if (scatterGuarantee === 3) {
      const buy = await window.XbootBooks.pickRandom(null, 3);
      if (buy) return buy;
      return window.XbootBooks.pickRandom((b) => b.scatterCount === 3);
    }
    if (scatterGuarantee === 4) {
      const buy = await window.XbootBooks.pickRandom(null, 4);
      if (buy) return buy;
      return window.XbootBooks.pickRandom((b) => b.scatterCount === 4);
    }
    return window.XbootBooks.pickRandom();
  }

  function takeNextBonusBookPreset() {
    if (!bonusPlaybackSpinsRef?.length) return null;
    if (bonusPlaybackSpinIdx >= bonusPlaybackSpinsRef.length) return null;
    return bonusPlaybackSpinsRef[bonusPlaybackSpinIdx++];
  }

  function beginBookSession(entry, scatterBuy = 0) {
    if (!entry) {
      activeBookSession = null;
      return;
    }
    activeBookSession = {
      entry,
      scatterBuy: scatterBuy === 3 || scatterBuy === 4 ? scatterBuy : 0,
      targetTotal: Math.max(0, Number(entry.totalWin) || 0) * bet,
      baseWin: 0,
      sessionPaid: 0,
      isJackpot: isJackpotBookEntry(entry)
    };
  }

  /** Базовый спин: выплата = расчёт ways на доске (таблица PAYOUTS в клиенте). */
  function bookBaseWinAmount(calcWin) {
    if (!activeBookSession) return calcWin;
    if (activeBookSession.entry.hasBonus) {
      activeBookSession.baseWin = calcWin;
    }
    return calcWin;
  }

  async function queueJackpotBook() {
    const store = window.XbootBooks?.getStore?.();
    if (!store?.ready) return false;
    if (store.jackpotSeed && (await window.XbootBooks.queueSeed(store.jackpotSeed))) {
      updateBooksDebugHud('джекпот');
      return true;
    }
    const jpId = store.jackpotBookId || 888888;
    if (await window.XbootBooks.queueSeed(String(jpId))) {
      updateBooksDebugHud(`джекпот #${jpId}`);
      return true;
    }
    return false;
  }

  async function loadXbootBooks(onProgress) {
    const spinBtn = document.getElementById('spinBtn');
    const scatterIx = SYMBOLS.indexOf('scatter');
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.textContent = 'Загрузка книг…';
    }
    updateBooksDebugHud('загрузка…');

    const ok = await window.XbootBooks.load(null, scatterIx, (p) => {
      onProgress?.(p);
    });
    booksReady = !!ok;
    const st = window.XbootBooks.getStore();
    updateBooksDebugHud(booksReady ? `API ${st.bookCount || 0}` : 'нет сервера');

    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.textContent = 'SPIN';
    }
    await applyUrlBookQueue();
    return booksReady;
  }

  async function runBonusSession(scatterCount, startBoard = null, startMults = null) {
    isSpinning = true;
    syncControlsState();
    bonusPlaybackSpinIdx = 0;
    try {
      await enterBonusMode(scatterCount, startBoard, startMults);
      await showBonusEntryModal(scatterCount);
      startBgMusic(bonusMainMusicFile(scatterCount));

      const isBonus4 = scatterCount >= 4;
      if (isBonus4) {
        await showTorpedoIntro();
      } else {
        await animateBonusReelExpand();
      }

      let maxWinEnded = false;
      while (freeSpinsRemaining > 0) {
        if (isBonus4 && !torpedoBarShown) {
          await showTorpedoIntro();
        }
        freeSpinsRemaining -= 1;
        updateBonusHud();
        syncControlsState();

        const spinResult = await doBonusSpin();
        if (spinResult === 'maxwin') {
          maxWinEnded = true;
          freeSpinsRemaining = 0;
          updateBonusHud();
          break;
        }
        if (freeSpinsRemaining > 0) {
          await sleep(BONUS_SPIN_PAUSE_MS);
        }
      }

      if (!maxWinEnded) {
        if (!isBonus4) {
          await animateBonusReelCollapse();
          await showBonus3EndModal(bonusTotalWin);
        } else {
          hideTorpedoWrap();
          await showBonusModal(
            'Бонус завершён',
            `Общий выигрыш: ${bonusTotalWin.toFixed(2)}`
          );
        }
      }
      if (activeBookSession && getBookSessionPaid() > 0) {
        await settle(0, getBookSessionPaid(), { ...getWinSettleMeta(), recordBigWinOnly: true });
      }
      activeBookSession = null;
      if (!maxWinEnded) {
        await exitBonusMode();
      }
    } finally {
      isSpinning = false;
      syncControlsState();
    }
  }

  function updateHud(winText) {
    document.getElementById('balanceDisplay').textContent = balance.toFixed(2);
    document.getElementById('betDisplay').textContent = bet.toFixed(2);
    const wEl = document.getElementById('winDisplay');
    if (winText != null) wEl.textContent = winText;
    document.getElementById('winLine').textContent = '';
    syncControlsState();
    updateBetNote();
  }

  function notifyBalance() {
    window.parent?.postMessage(
      { type: 'CASINO_BALANCE_UPDATED', balance },
      window.location.origin
    );
  }

  async function loadBalance() {
    try {
      const data = await CASINO_API.getBalance();
      balance = Number(data.balance) || 0;
      updateHud('0.00');
      notifyBalance();
    } catch (e) {
      if (e.status === 401) {
        balance = 0;
        casinoApiAvailable = false;
        updateHud('0.00');
        return;
      }
      casinoApiAvailable = false;
      balance = 1000;
      updateHud('0.00');
    }
  }

  async function settle(betAmt, winAmt, meta = {}) {
    const bet = Math.max(0, Number(betAmt) || 0);
    const win = Math.max(0, Number(winAmt) || 0);

    if (replayMode) return;

    if (!casinoApiAvailable) {
      if (!meta.recordBigWinOnly) {
        balance += win - bet;
        notifyBalance();
      }
      return;
    }

    const payload = {
      ...getWinSettleMeta(),
      ...meta
    };

    const result = await CASINO_API.settleSpin(bet, win, payload);
    if (result?.ok) {
      if (!meta.recordBigWinOnly) {
        balance = Number(result.balance) || balance;
      }
    } else if (result?.status === 401) {
      casinoApiAvailable = false;
      if (!meta.recordBigWinOnly) {
        balance = Math.round((balance + win - bet) * 100) / 100;
      }
    } else {
      if (!meta.recordBigWinOnly) {
        balance = Math.round((balance + win - bet) * 100) / 100;
      }
    }
    if (!meta.recordBigWinOnly) {
      notifyBalance();
    }
  }

  function initGoldRain() {
    const root = document.getElementById('goldRain');
    if (!root || root.childElementCount) return;
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 1.2}s`;
      s.style.animationDuration = `${0.8 + Math.random() * 0.8}s`;
      root.appendChild(s);
    }
  }

  async function animateXWays(b, m, xwInfo) {
    if (!xwInfo.positions.length) return;
    const { positions, replacement } = xwInfo;
    const targets = positions.map((p) => getSymbolEl(p.r, p.row)).filter(Boolean);

    await sleep(400);
    for (const el of targets) {
      el.classList.remove('xways-flicker');
      el.style.transition = 'opacity 0.52s ease-out, filter 0.52s ease-out';
      el.style.opacity = '0';
      el.style.filter = 'brightness(0.55)';
    }
    playSlotSound(SOUND_XWAYS);
    await sleep(540);
    applyXWaysFinal(b, m, positions, replacement);
    renderBoard(b, m);
    for (const { r, row } of positions) {
      const el = getSymbolEl(r, row);
      if (!el) continue;
      el.style.transition = 'opacity 0.42s ease-in, filter 0.42s ease-in';
      el.style.opacity = '0';
      el.style.filter = '';
      void el.offsetWidth;
      el.style.opacity = '1';
    }
    await sleep(420);
    for (const { r, row } of positions) {
      const el = getSymbolEl(r, row);
      if (!el) continue;
      el.style.transition = '';
      el.style.opacity = '';
      el.style.filter = '';
    }
  }

  function buildNudgeBoardAfterPush(prev, expandRow) {
    const rows = prev.length;
    const cap = Math.min(Math.max(0, expandRow), rows - 1);
    const next = Array.from({ length: rows }, (_, row) =>
      row === 0 ? 'xNudge' : prev[row - 1]
    );
    for (let row = 0; row <= cap; row++) next[row] = 'xNudge';
    return next;
  }

  /** Пошаговый толчок барабана (wind-up → 1 ячейка вниз). */
  async function animateNudgePushToRow(reel, b, mRow, expandRow, mult) {
    const drum = getReelDrum(reel);
    const content = getReelContent(reel);
    if (!drum || !content) return;

    const h = getSymbolHeight();
    const rows = getReelRows(reel);
    const prev = b[reel].map((s) => s);
    const next = buildNudgeBoardAfterPush(prev, expandRow);
    const landInfo = getXNudgeLandInfo(prev);
    const fromV = getXNudgeVisibleCount(prev) || landInfo?.visible || 0;
    const fromTopPx = landInfo?.dropped ? landInfo.anchorRow * h : 0;

    const windUpPx = Math.min(
      Math.round(h * NUDGE_PUSH_WINDUP_FRAC),
      NUDGE_PUSH_WINDUP_MAX_PX
    );
    const pushDownPx = -h;
    const host = getNudgeStackHost(reel);

    renderReelContent(reel, prev, mRow, 0);
    forceReflowStrip(drum);

    let layer = host.querySelector(':scope > .xnudge-stack:not(.xnudge-strip-stack)');
    if (!layer) {
      layer = createXNudgeStackElement();
      host.insertBefore(layer, content);
    }
    layer.classList.add('xnudge-stack--pushing');
    applyXNudgeStackFullFile(layer, fromV, fromTopPx, reel);

    setStripCompositing(drum, true);
    drum.classList.add('nudge-drum-pushing');
    reelTransformY(drum, 0);

    await new Promise((resolve) => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / NUDGE_PUSH_WINDUP_MS, 1);
        reelTransformY(drum, Math.round(windUpPx * easeOutCubic(t)));
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    playSlotSound(SOUND_NUDGE_BAM);

    await new Promise((resolve) => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / NUDGE_PUSH_MS, 1);
        const eased = easeOutCubic(t);
        const drumOffset = Math.round(windUpPx + (pushDownPx - windUpPx) * eased);
        reelTransformY(drum, drumOffset);

        if (t >= 1) {
          for (let row = 0; row < rows; row++) b[reel][row] = next[row];
          reelTransformY(drum, 0);
          renderReelStrip(reel, b[reel], mRow, 0);
          setStripCompositing(drum, false);
          drum.classList.remove('nudge-drum-pushing');
          layer.classList.remove('xnudge-stack--pushing');
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    bumpReelNudgeMultDisplay(reel);
    updateReelNudgeMultDisplay(reel, mult);
    await sleep(120);
  }

  /** Пошаговый nudge (wind-up → 1 ряд вниз), как при попадании TARGET. */
  async function animateNudgeStepPushes(reel, b, mRow, finalMult, opts = {}) {
    const rows = getReelRows(reel);
    let visible = getXNudgeVisibleCount(b[reel]);
    const landInfo = getXNudgeLandInfo(b[reel]);

    if (opts.collapseDropped && landInfo?.dropped && landInfo.anchorRow >= 0) {
      for (let row = 0; row <= landInfo.anchorRow; row++) b[reel][row] = 'xNudge';
      visible = landInfo.anchorRow + 1;
      renderReelStrip(reel, b[reel], mRow);
    }

    reelNudgeMult[reel] = 1;
    updateReelNudgeMultDisplay(reel, 1);

    await sleep(350);
    playSlotSound(SOUND_NUDGE);

    let reelMult = 1;
    const nudgesNeeded = Math.max(0, finalMult - 1);
    visible = Math.max(visible, getXNudgeVisibleCount(b[reel]));

    for (let n = 0; n < nudgesNeeded; n++) {
      reelMult += 1;
      reelNudgeMult[reel] = reelMult;
      const expandRow = Math.min(visible, rows - 1);
      await animateNudgePushToRow(reel, b, mRow, expandRow, reelMult);
      visible = Math.min(rows, getXNudgeVisibleCount(b[reel]));
      await sleep(160);
    }
  }

  async function animateXNudge(b, m, stacks) {
    for (const { reel, visible: initialVisible } of stacks) {
      const maxVisible = Math.min(getXNudgeStackSize(reel), getReelRows(reel));

      reelNudgeMult[reel] = 1;
      updateReelNudgeMultDisplay(reel, 1);

      if (initialVisible >= maxVisible) {
        reelNudgeMult[reel] = maxVisible;
        updateReelNudgeMultDisplay(reel, maxVisible);
        await swapNudgeReelToWild(reel, b, m[reel]);
        continue;
      }

      renderReelStrip(reel, b[reel], m[reel]);
      const finalMult = maxVisible - initialVisible + 1;
      await animateNudgeStepPushes(reel, b, m[reel], finalMult);

      await swapNudgeReelToWild(reel, b, m[reel]);
    }
  }

  function spinReel(
    reelIndex,
    finalSymbols,
    scrollVPxPerMs,
    tDecelStartMs,
    forcedSpinSymbols,
    spinCallbacks = {}
  ) {
    const { onReelSettled, tailHold, extraStopMsByReel } = spinCallbacks;
    const isTailHeld = tailHold && BONUS_TAIL_REELS.includes(reelIndex);
    const teaseMs = Math.max(0, Number(extraStopMsByReel?.[reelIndex]) || 0);

    return new Promise((resolve) => {
      const reelContent = getReelContent(reelIndex);
      if (!reelContent) {
        resolve();
        return;
      }

      const symbolHeight = getSymbolHeight();
      const numVisible = getReelRows(reelIndex);
      const currentSymbols = board[reelIndex].map((s) => s);
      const totalSpinSymbols = calcSpinStripSymbols(SPIN_DURATION, forcedSpinSymbols);

      const useBonusTargetStrip =
        bonusMode &&
        bonusReelExpanded &&
        reelIndex === BONUS_EXPAND_REEL;
      const spinStripLen = totalSpinSymbols;
      const bonusSpinStripSyms = useBonusTargetStrip
        ? buildBonusExpandSpinStripSymbols(spinStripLen)
        : null;

      const appendFinalSpinStrip = (frag, finals, currents) => {
        for (let row = 0; row < numVisible; row++) {
          frag.appendChild(cloneStripSymbol(finals[row], 1, finals));
        }
        if (bonusSpinStripSyms) {
          for (let i = 0; i < spinStripLen; i++) {
            frag.appendChild(cloneStripSymbol(bonusSpinStripSyms[i], 0, null, { spinStrip: true }));
          }
        } else {
          appendSpinStripItems(
            frag,
            buildSpinStripItems(reelIndex, spinStripLen),
            reelIndex
          );
        }
        for (let row = 0; row < numVisible; row++) {
          frag.appendChild(
            cloneStripSymbol(currents[row], mults[reelIndex][row] || 1, currents)
          );
        }
      };

      const stripFrag = document.createDocumentFragment();
      appendFinalSpinStrip(stripFrag, finalSymbols, currentSymbols);

      clearReelXNudgeOverlays(reelIndex);

      const spinCyclePx = spinStripLen * symbolHeight;
      const minSpinOffsetPx = numVisible * symbolHeight;
      const scrollV = Math.max(1e-6, Number(scrollVPxPerMs) || 0);
      const startOffset = (numVisible + spinStripLen) * symbolHeight;

      reelContent.style.transition = 'none';
      reelContent.replaceChildren(stripFrag);
      mountStripXNudgeStack(reelContent, finalSymbols, 0, reelIndex);
      forceReflowStrip(reelContent);
      reelTransformY(reelContent, startOffset);
      setStripCompositing(reelContent, true);

      const delay = reelIndex * getReelStartStaggerMs();
      const tDecelStart = Math.max(0, Number(tDecelStartMs) || 0);
      const decelMs = getReelDecelMs();
      const tDecelEnd = tDecelStart + teaseMs + decelMs;

      const controller = {
        reelIndex,
        started: false,
        finished: false,
        fast: false,
        fastStart: 0,
        offAtFastStart: 0,
        startPerf: 0,
        startOffset,
        scrollV,
        tDecelStart,
        teaseMs,
        decelMs,
        tDecelEnd,
        spinCyclePx,
        minSpinOffsetPx,
        startTimeoutId: null,
        infiniteSpin: false,
        landingPrepared: false,
        releaseDecelStart: 0,
        releaseStartOff: 0,
        currentOffset: startOffset,
        startAnimation: null,
        readOffset: null
      };
      activeReelControllers[reelIndex] = controller;

      const finishReel = () => {
        if (controller.finished) return;
        controller.finished = true;
        activeReelControllers[reelIndex] = null;
        playSlotSound(SOUND_STOP);
        board[reelIndex] = finalSymbols.map((s) => s);
        mults[reelIndex] = Array.from({ length: numVisible }, () => 1);
        renderReelStrip(reelIndex, board[reelIndex], mults[reelIndex], 0);
        setStripCompositing(reelContent, false);
        if (onReelSettled) onReelSettled(reelIndex);
        resolve();
      };

      const offsetAtDecelStart = () =>
        Math.max(0, controller.startOffset - controller.scrollV * controller.tDecelStart);

      const offsetForHeadSpin = (elapsed) => {
        const { startOffset, scrollV, tDecelStart, teaseMs, decelMs } = controller;
        if (elapsed < tDecelStart) {
          return Math.max(0, startOffset - scrollV * elapsed);
        }
        const offAtDecel = offsetAtDecelStart();
        if (elapsed < tDecelStart + teaseMs) {
          return Math.max(0, offAtDecel - scrollV * (elapsed - tDecelStart));
        }
        const offAfterTease = Math.max(0, offAtDecel - scrollV * teaseMs);
        const u = Math.min((elapsed - tDecelStart - teaseMs) / decelMs, 1);
        return offAfterTease * (1 - easeOutReelStop(u));
      };

      const offsetForInfiniteSpin = (elapsed) => {
        const extra = controller.scrollV * TAIL_HOLD_SPIN_SPEED * (elapsed - controller.tDecelStart);
        let off = offsetAtDecelStart() - extra;
        const cycle = Math.max(symbolHeight, controller.spinCyclePx);
        const floor = controller.minSpinOffsetPx;
        while (off < floor) off += cycle;
        return off;
      };

      const prepareTailLandingStrip = () => {
        const landingFrag = document.createDocumentFragment();
        appendFinalSpinStrip(landingFrag, finalSymbols, currentSymbols);
        reelContent.replaceChildren(landingFrag);
        mountStripXNudgeStack(reelContent, finalSymbols, 0, reelIndex);
        forceReflowStrip(reelContent);
        return Math.max(
          controller.currentOffset,
          (numVisible + 1) * symbolHeight
        );
      };

      controller.readOffset = (elapsed) => {
        const el = Math.max(0, Number(elapsed) || 0);
        if (isTailHeld) {
          if (!tailHold.released) {
            if (el < controller.tDecelStart) {
              return computeReelSpinOffsetPx(
                controller.startOffset,
                controller.scrollV,
                controller.tDecelStart,
                controller.decelMs,
                el
              );
            }
            return offsetForInfiniteSpin(el);
          }

          if (!controller.landingPrepared) {
            return offsetForInfiniteSpin(el);
          }

          const decelElapsed = Math.max(0, performance.now() - controller.releaseDecelStart);
          const u = Math.min(decelElapsed / controller.decelMs, 1);
          return controller.releaseStartOff * (1 - easeOutReelStop(u));
        }

        return offsetForHeadSpin(el);
      };

      const tickTailHeld = (now, elapsed) => {
        if (!tailHold.released) {
          if (controller.fast) {
            if (now < controller.fastStart) {
              controller.currentOffset = controller.readOffset(elapsed);
              reelTransformY(reelContent, controller.currentOffset);
              return false;
            }
            if (!controller.landingPrepared) {
              controller.landingPrepared = true;
              controller.releaseStartOff = prepareTailLandingStrip();
              controller.releaseDecelStart = now;
              reelTransformY(reelContent, controller.releaseStartOff);
              setStripCompositing(reelContent, true);
            }
          } else if (elapsed < controller.tDecelStart) {
            controller.currentOffset = computeReelSpinOffsetPx(
              controller.startOffset,
              controller.scrollV,
              controller.tDecelStart,
              controller.decelMs,
              elapsed
            );
            reelTransformY(reelContent, controller.currentOffset);
            return false;
          } else {
            controller.infiniteSpin = true;
            controller.currentOffset = offsetForInfiniteSpin(elapsed);
            reelTransformY(reelContent, controller.currentOffset);
            return false;
          }
        }

        if (!tailHold.releasedAt) tailHold.releasedAt = now;
        const tailReleaseIndex = BONUS_TAIL_REELS.indexOf(reelIndex);
        const releaseDelay = Math.max(0, tailReleaseIndex) * TAIL_RELEASE_STAGGER_MS;
        if (!controller.fast && now < tailHold.releasedAt + releaseDelay) {
          controller.currentOffset = offsetForInfiniteSpin(elapsed);
          reelTransformY(reelContent, controller.currentOffset);
          return false;
        }

        if (!controller.landingPrepared) {
          controller.landingPrepared = true;
          controller.releaseStartOff = prepareTailLandingStrip();
          controller.releaseDecelStart = controller.fast
            ? Math.max(now, controller.fastStart)
            : now;
          reelTransformY(reelContent, controller.releaseStartOff);
          setStripCompositing(reelContent, true);
        }

        if (controller.fast && now < controller.fastStart) {
          controller.currentOffset = offsetForInfiniteSpin(elapsed);
          reelTransformY(reelContent, controller.currentOffset);
          return false;
        }

        const decelElapsed = now - controller.releaseDecelStart;
        const u = Math.min(decelElapsed / controller.decelMs, 1);
        controller.currentOffset = controller.releaseStartOff * (1 - easeOutReelStop(u));
        reelTransformY(reelContent, controller.currentOffset);
        if (u >= 1) {
          finishReel();
          return true;
        }
        return false;
      };

      const tickHeadSpin = (now, elapsed) => {
        if (controller.fast) {
          if (now < controller.fastStart) {
            controller.currentOffset = offsetForHeadSpin(elapsed);
          } else {
            const f = Math.min((now - controller.fastStart) / controller.decelMs, 1);
            controller.currentOffset = controller.offAtFastStart * (1 - easeOutReelStop(f));
            if (f >= 1) {
              finishReel();
              return true;
            }
          }
        } else {
          controller.currentOffset = offsetForHeadSpin(elapsed);
          if (elapsed >= controller.tDecelEnd) {
            finishReel();
            return true;
          }
        }

        reelTransformY(reelContent, controller.currentOffset);
        return false;
      };

      const startAnimation = () => {
        if (controller.started) return;
        controller.started = true;
        controller.startPerf = performance.now();

        scheduleSpinAnimator({
          tick(now) {
            const elapsed = now - controller.startPerf;
            if (isTailHeld) return tickTailHeld(now, elapsed);
            return tickHeadSpin(now, elapsed);
          }
        });
      };

      controller.startAnimation = startAnimation;

      controller.startTimeoutId = setTimeout(() => {
        controller.startTimeoutId = null;
        startAnimation();
      }, delay);
    });
  }

  async function spinReels(finalBoard, spinOpts = {}) {
    activeReelControllers = new Array(NUM_REELS).fill(null);
    beginReelSpinSkip();

    try {
    const symbolHeight = getSymbolHeight();
    const extraByReel = Array(NUM_REELS).fill(0);
    const extraStopMsByReel = spinOpts.extraStopMsByReel || {};
    const waysInterReelGapMs = spinOpts.waysInterReelGapMs || {};
    const scatterInterReelGapMs = spinOpts.scatterInterReelGapMs || {};

    const baseSpinSymbols = calcSpinStripSymbols(SPIN_DURATION);
    const s0 = (getReelRows(0) + baseSpinSymbols) * symbolHeight;
    const spinBaseLinearMs = getReelSpinBaseLinearMs();
    const reelDecelMs = getReelDecelMs();
    const scrollV = (REEL_SPIN_LINEAR_FRAC * s0) / spinBaseLinearMs;
    const decelDistance = Math.max(0, s0 - scrollV * spinBaseLinearMs);

    const tDecelStartByReel = [];
    const totalSpinSymbolsByReel = [];
    let prevStopAbs = 0;
    let headMaxStopMs = 0;

    for (let i = 0; i < NUM_REELS; i++) {
      const delay = i * getReelStartStaggerMs();
      const teaseMs = Math.max(0, Number(extraStopMsByReel[i]) || 0);
      const waysInterGap = Math.max(0, Number(waysInterReelGapMs[i]) || 0);
      const scatterGap = Math.max(0, Number(scatterInterReelGapMs[i]) || 0);

      let minStopAbs;
      if (i === 0) {
        minStopAbs =
          delay + spinBaseLinearMs + extraByReel[i] + reelDecelMs;
      } else {
        const stopStaggerMs = scatterGap > 0 ? 0 : getReelStopStaggerMs();
        minStopAbs = prevStopAbs + stopStaggerMs + waysInterGap + scatterGap;
      }

      const numVisible = getReelRows(i);
      let localTDecel = Math.max(
        0,
        minStopAbs - delay - teaseMs - reelDecelMs
      );

      let requiredOffset = scrollV * (localTDecel + teaseMs) + decelDistance;
      let neededSymbols = Math.ceil(requiredOffset / symbolHeight) - numVisible;
      neededSymbols = Math.max(1, neededSymbols);

      const bonusTargetStrip =
        bonusMode && bonusReelExpanded && i === BONUS_EXPAND_REEL;
      let stripLen = bonusTargetStrip
        ? Math.max(BONUS_TARGET_SPIN_STRIP_LEN, neededSymbols)
        : neededSymbols;

      const actualOffset = (numVisible + stripLen) * symbolHeight;
      const stripBasedTDecel = Math.max(
        0,
        (actualOffset - decelDistance) / scrollV - teaseMs
      );
      localTDecel = Math.max(localTDecel, stripBasedTDecel);

      if (teaseMs > 0 && i === BONUS_EXPAND_REEL) {
        const reel2Delay = getReelStartStaggerMs();
        const reel2StopAbs =
          reel2Delay + tDecelStartByReel[1] + reelDecelMs;
        localTDecel = Math.max(localTDecel, reel2StopAbs - delay);
      }

      requiredOffset = scrollV * (localTDecel + teaseMs) + decelDistance;
      neededSymbols = Math.ceil(requiredOffset / symbolHeight) - numVisible;
      neededSymbols = Math.max(1, neededSymbols);
      if (bonusTargetStrip) {
        stripLen = Math.max(BONUS_TARGET_SPIN_STRIP_LEN, neededSymbols);
      } else {
        stripLen = neededSymbols;
      }

      tDecelStartByReel[i] = localTDecel;
      totalSpinSymbolsByReel[i] = stripLen;
      prevStopAbs = delay + localTDecel + teaseMs + reelDecelMs;

      if (i <= BONUS_EXPAND_REEL) {
        headMaxStopMs = Math.max(headMaxStopMs, prevStopAbs);
      }
    }

    if (spinOpts.tailHold && headMaxStopMs > 0) {
      for (const i of BONUS_TAIL_REELS) {
        const delay = i * getReelStartStaggerMs();
        const minTailTDecel = Math.max(
          0,
          headMaxStopMs - delay - reelDecelMs
        );
        if (tDecelStartByReel[i] < minTailTDecel) {
          tDecelStartByReel[i] = minTailTDecel;
          const numVisible = getReelRows(i);
          const requiredOffset = scrollV * minTailTDecel + decelDistance;
          let neededSymbols =
            Math.ceil(requiredOffset / symbolHeight) - numVisible;
          neededSymbols = Math.max(1, neededSymbols);
          totalSpinSymbolsByReel[i] = neededSymbols;
        }
      }
    }

    const lastReelIndex = NUM_REELS - 1;
    const userOnReelSettled = spinOpts.onReelSettled;

    for (let r = 0; r < NUM_REELS; r++) clearReelXNudgeOverlays(r);

    startReelSpinSound();

    const spinCallbacks = {
      onReelSettled: (reelIdx) => {
        if (reelIdx === lastReelIndex) stopReelSpinSound();
        playNudgeLandSoundOnReelSettled(reelIdx, finalBoard);
        playXWaysLandSoundOnReelSettled(reelIdx, finalBoard);
        if (userOnReelSettled) userOnReelSettled(reelIdx);
      },
      tailHold: spinOpts.tailHold || null,
      extraStopMsByReel
    };

    const reelPromises = activeReelRows.map((_, i) =>
      spinReel(
        i,
        finalBoard[i],
        scrollV,
        tDecelStartByReel[i],
        totalSpinSymbolsByReel[i],
        spinCallbacks
      )
    );

    if (spinCallbacks.tailHold) {
      await Promise.all([0, 1, 2].map((i) => reelPromises[i]));
      return { tailPromises: BONUS_TAIL_REELS.map((i) => reelPromises[i]) };
    }

    await Promise.all(reelPromises);
    return { tailPromises: null };
    } finally {
      clearReelSpinSkip();
      activeReelControllers = [];
    }
  }

  async function doBonus4Spin() {
    clearWinPresentation();
    document.getElementById('winDisplay').textContent = '0.00';

    const bookPreset = takeNextBonusBookPreset();
    const fromBook = !!bookPreset;
    const spinIndex = fromBook ? bonusPlaybackSpinIdx - 1 : -1;
    const maxWinBook = isMaxWinBookSession();
    const jackpotBuild = fromBook && maxWinBook && spinIndex >= 0 && spinIndex < 4;
    const jackpotFinal = fromBook && maxWinBook && spinIndex === 6;
    const runLiveMechanics = !fromBook || jackpotBuild || jackpotFinal;
    const bookTorpedoDrops = fromBook ? bookPreset.torpedoDrops || [] : [];

    let b;
    let m;
    let raw;
    let bookTargetNudge = null;
    let needsBookNudge = false;

    if (fromBook) {
      const applied = applyBookSpinPreset(bookPreset, activeReelRows);
      const bookSetup = setupBookSpinFromPreset(applied);
      b = bookSetup.b;
      m = bookSetup.m;
      raw = bookSetup.raw;
      bookTargetNudge = bookSetup.bookTargetNudge;
      needsBookNudge = bookSetup.needsBookNudge;
      if (bookTorpedoDrops.length) {
        applyBookTorpedoLandingBoard(b, m, bookTorpedoDrops);
        raw = b.map((col) => [...col]);
      }
    } else {
      reelNudgeMult = [1, 1, 1, 1, 1, 1];
      resetAllReelNudgeDisplays();
      raw = generateRawBoard();
      b = raw.map((col) => [...col]);
      m = activeReelRows.map((rows) => Array.from({ length: rows }, () => 1));
    }

    const waysTease = buildWaysTeasePlan(b);
    const scatterPlan = buildScatterSpinPlan(b);

    let torpedoCompleted = false;
    let shouldNudgeAnim = false;

    try {
      await spinReels(raw, {
        waysInterReelGapMs: waysTease.waysInterReelGapMs,
        onReelSettled: (reelIdx) => {
          scatterPlan.onReelSettled(reelIdx, b);
          if (waysTease.hasTease) waysTease.onReelSettled(reelIdx, b);
        }
      });

      syncSpinBoardFromRaw(b, m, raw);
      board = b;
      mults = m;

      if (!bonusMode) return;

      shouldNudgeAnim =
        boardHasXNudgeStacks(b) ||
        (fromBook && bookHasNudgeAnimTarget(bookTargetNudge));

      if (shouldNudgeAnim) {
        if (fromBook) restoreBookBoardForNudgeAnim(b, m, bookTargetNudge);
        await runBookNudgeAnimation(b, m, bookTargetNudge);
      } else if (runLiveMechanics || bookTorpedoDrops.length) {
        if (runLiveMechanics) {
          const xwInfo = resolveXWays(b, m);
          if (xwInfo.positions.length) await animateXWays(b, m, xwInfo);

          const nudgeStacks = detectXNudgeStacks(b);
          if (nudgeStacks.length) await animateXNudge(b, m, nudgeStacks);
        }

        if (fromBook && bookTorpedoDrops.length) {
          torpedoCompleted = await replayBookTorpedoDrops(b, m, bookTorpedoDrops, bookPreset);
        } else if (runLiveMechanics) {
          torpedoCompleted = await processBonus4TorpedoDrops(b, m);
          if (torpedoCompleted) {
            await animateTorpedoCompleteOnLane();
          }
        }
      }
    } finally {
      scatterPlan.clear();
      waysTease.clear();
    }

    if (!bonusMode) return;

    if (fromBook && bookTargetNudge && !shouldNudgeAnim) {
      applyBookNudgeMultsForPayout(bookTargetNudge);
    }

    renderBoard(b, m);

    const winInfo = calculateWaysWin(bet, b, m);
    const bonusBefore = bonusTotalWin;
    const triggerMaxWin = shouldTriggerMaxWinScene(winInfo.totalWin, bonusBefore, {
      jackpotFinal
    });
    let paid = winInfo.totalWin;
    if (activeBookSession) {
      paid = await settleBookWin(winInfo.totalWin);
    } else {
      await settle(0, winInfo.totalWin, getWinSettleMeta());
    }
    if (activeBookSession) {
      bonusTotalWin = getBookSessionPaid();
    } else {
      bonusTotalWin += paid;
    }

    if (triggerMaxWin) {
      const remainder = await settleMaxWinCapRemainder();
      if (remainder > 0) {
        bonusTotalWin = getBookSessionPaid();
      }
      updateHud(bonusTotalWin.toFixed(2));
      updateBonusHud();
      await playMaxWinPrelude(winInfo.highlights);
      await runMaxWinScene();
      return 'maxwin';
    }

    updateHud(paid.toFixed(2));
    updateBonusHud();

    if (paid > 0) {
      await showWinPresentation({ ...winInfo, totalWin: paid });
    } else {
      document.getElementById('winLine').textContent =
        winInfo.totalWays > 0 ? `Ways: ${winInfo.totalWays}` : '';
    }

    if (torpedoCompleted) {
      await sleep(torpedoResolved ? 280 : 0);
      await animateTorpedoExit();
      torpedoResolved = null;
    }
  }

  async function doBonusSpin() {
    if (isBonus4Mode()) {
      return doBonus4Spin();
    }

    clearWinPresentation();
    document.getElementById('winDisplay').textContent = '0.00';

    const bookPreset = takeNextBonusBookPreset();
    const fromBook = !!bookPreset;

    let b;
    let m;
    let raw;
    let bookTargetNudge = null;
    let needsBookNudge = false;

    let bookTargetCeremony = false;
    let bookBoardRef = null;

    if (fromBook) {
      const applied = applyBookSpinPreset(bookPreset, activeReelRows);
      const bookSetup = setupBookSpinFromPreset(applied);
      b = bookSetup.b;
      m = bookSetup.m;
      raw = bookSetup.raw;
      bookTargetNudge = bookSetup.bookTargetNudge;
      bookBoardRef = bookSetup.bookBoard;
      needsBookNudge = bookSetup.needsBookNudge;
      bookTargetCeremony = bookHasTargetCeremony(bookBoardRef, bookTargetNudge);
      if (bookTargetCeremony) {
        prepareBookTargetBoardForAnim(b, bookTargetNudge, bookBoardRef);
        raw = b.map((col) => [...col]);
      }
    } else {
      reelNudgeMult = [1, 1, 1, 1, 1, 1];
      resetAllReelNudgeDisplays();
      raw = generateRawBoard();
      b = raw.map((col) => [...col]);
      m = activeReelRows.map((rows) => Array.from({ length: rows }, () => 1));
    }

    const matchSyms =
      isBonus3Mode() ? getFirstTwoReelsMatchSymbols(b) : [];
    const targetTease = isBonus3Mode() && matchSyms.length > 0;
    const hasTarget = findTargetOnBoard(b) >= 0;
    const tailHold = hasTarget && targetTease ? createTailSpinHold() : null;

    const waysTease = buildWaysTeasePlan(b);
    const scatterPlan = buildScatterSpinPlan(b);
    const targetPrelude = buildBonusTargetPreludePlan(matchSyms);
    let targetResolvePromise = null;

    try {
      const { tailPromises } = await spinReels(raw, {
        extraStopMsByReel: targetTease
          ? { [BONUS_EXPAND_REEL]: TARGET_TEASE_MS }
          : {},
        waysInterReelGapMs: mergeInterReelGapMs(
          waysTease.waysInterReelGapMs,
          scatterPlan.scatterInterReelGapMs
        ),
        tailHold,
        onReelSettled: (reelIdx) => {
          scatterPlan.onReelSettled(reelIdx, b);
          if (targetPrelude.active) targetPrelude.onReelSettled(reelIdx, b);
          if (
            targetTease &&
            tailHold &&
            reelIdx === BONUS_EXPAND_REEL &&
            findTargetOnBoard(b) >= 0 &&
            !targetResolvePromise
          ) {
            targetResolvePromise = bookTargetCeremony
              ? resolveBonusTargetFromBook(b, m, bookTargetNudge, tailHold)
              : resolveBonusTarget(b, m, tailHold);
          }
          if (waysTease.hasTease) waysTease.onReelSettled(reelIdx, b);
        },
      });

      syncSpinBoardFromRaw(b, m, raw);
      board = b;
      mults = m;

      if (!bonusMode) return;

      if (tailPromises) {
        await (targetResolvePromise || Promise.resolve());
        if (tailHold && !tailHold.released) {
          releaseBonusTailHold(tailHold);
        }
        await Promise.all(tailPromises);
      }
      if (!fromBook) {
        const xwInfo = resolveXWays(b, m);
        if (xwInfo.positions.length) await animateXWays(b, m, xwInfo);
      } else if (bookTargetCeremony && bookPreset) {
        const applied = applyBookSpinPreset(bookPreset, activeReelRows);
        b[BONUS_EXPAND_REEL] = applied.board[BONUS_EXPAND_REEL].slice();
        m[BONUS_EXPAND_REEL] = applied.mults[BONUS_EXPAND_REEL].slice();
        board = b;
        mults = m;
      }
    } finally {
      targetPrelude.clear();
      waysTease.clear();
      scatterPlan.clear();
    }

    if (!bonusMode) return;

    const shouldNudgeAnim =
      boardHasXNudgeStacks(b) ||
      (fromBook && bookHasNudgeAnimTarget(bookTargetNudge));

    if (shouldNudgeAnim) {
      if (fromBook) {
        restoreBookBoardForNudgeAnim(b, m, bookTargetNudge);
        await runBookNudgeAnimation(b, m, bookTargetNudge);
      } else {
        const nudgeStacks = detectXNudgeStacks(b);
        if (nudgeStacks.length) await animateXNudge(b, m, nudgeStacks);
      }
    } else if (fromBook && bookTargetNudge) {
      applyBookNudgeMultsForPayout(bookTargetNudge);
    }

    renderBoard(b, m);

    const winInfo = calculateWaysWin(bet, b, m);
    bonusTotalWin += winInfo.totalWin;

    await settle(0, winInfo.totalWin, getWinSettleMeta());

    updateHud(winInfo.totalWin.toFixed(2));
    updateBonusHud();

    if (winInfo.totalWin > 0) {
      await showWinPresentation(winInfo);
    }
  }

  async function doSpin() {
    if (isSpinning) return;
    if (bonusMode && freeSpinsRemaining > 0) {
      isSpinning = true;
      freeSpinsRemaining -= 1;
      updateBonusHud();
      syncControlsState();
      try {
        await doBonusSpin();
      } catch {
        /* ignore */
      } finally {
        isSpinning = false;
        syncControlsState();
      }
      return;
    }

    const scatterGuarantee = pendingScatterGuarantee;
    const finalBet = getFinalBet();

    if (balance < finalBet) {
      alert('Недостаточно средств');
      return;
    }

    if (scatterGuarantee > 0) {
      pendingScatterGuarantee = 0;
      syncModUI();
      updateBetNote();
    }
    closeModPanel();

    if (!booksReady) {
      alert('Сервер книг недоступен.\n\nnpm run xboot-books-v2\nnpm run xboot-books-server');
      return;
    }

    const presetBook = await resolveBookForSpin(scatterGuarantee);
    if (!presetBook?.spin?.reel0) {
      const hint =
        scatterGuarantee === 3
          ? 'Нет книг покупки 3 scatter.\n\nnpm run xboot-buy-books'
          : scatterGuarantee === 4
            ? 'Нет книг покупки 4 scatter.\n\nnpm run xboot-buy-books'
            : 'Не удалось получить книгу.';
      alert(hint);
      return;
    }

    bonusPlaybackSpinsRef =
      presetBook.hasBonus && presetBook.bonusSpins?.length
        ? presetBook.bonusSpins.slice()
        : null;
    bonusPlaybackSpinIdx = 0;
    beginBookSession(presetBook, scatterGuarantee);

    isSpinning = true;
    syncControlsState();
    clearWinPresentation();
    document.getElementById('winDisplay').textContent = '0.00';

    const applied = applyBookSpinPreset(presetBook.spin, BASE_REEL_ROWS);
    const bookSetup = setupBookSpinFromPreset(applied);
    const raw = bookSetup.raw;
    const b = bookSetup.b;
    const m = bookSetup.m;
    const bookTargetNudge = bookSetup.bookTargetNudge;
    const needsBookNudge = bookSetup.needsBookNudge;

    const waysTease = buildWaysTeasePlan(b);
    const scatterPlan = buildScatterSpinPlan(b, { scatterGuarantee });

    try {
      await settle(finalBet, 0);
      updateHud('0.00');

      await spinReels(raw, {
        waysInterReelGapMs: mergeInterReelGapMs(
          waysTease.waysInterReelGapMs,
          scatterPlan.scatterInterReelGapMs
        ),
        onReelSettled: (reelIdx) => {
          scatterPlan.onReelSettled(reelIdx, b);
          if (waysTease.hasTease) waysTease.onReelSettled(reelIdx, b);
        }
      });
      syncSpinBoardFromRaw(b, m, raw);
      board = b;
      mults = m;

      if (needsBookNudge || boardHasXNudgeStacks(b)) {
        await runBookNudgeAnimation(b, m, bookTargetNudge);
      }
      if (bookTargetNudge) {
        applyBookNudgeMultsForPayout(bookTargetNudge);
      }

      renderBoard(b, m);

      let winInfo = calculateWaysWin(bet, b, m);
      const scatters = presetBook.scatterCount ?? countScatters(b);
      const bookWin = bookBaseWinAmount(winInfo.totalWin);
      winInfo = { ...winInfo, totalWin: bookWin };

      let basePaid = winInfo.totalWin;
      if (activeBookSession) {
        basePaid = await settleBookWin(winInfo.totalWin);
      } else {
        await settle(0, winInfo.totalWin, getWinSettleMeta());
      }
      winInfo = { ...winInfo, totalWin: basePaid };

      updateHud(basePaid.toFixed(2));
      updateBooksDebugHud(
        isJackpotBookEntry(presetBook)
          ? `ДЖЕКПОТ · ${presetBook.spin.seed}`
          : `спин: ${presetBook.spin.seed}`
      );

      if (winInfo.totalWin > 0 && !presetBook.hasBonus) {
        await showWinPresentation(winInfo);
      }

      const bonusEntry =
        scatterGuarantee === 3 || scatterGuarantee === 4
          ? scatterGuarantee
          : scatters >= 3
            ? scatters
            : 0;

      if (bonusEntry >= 3 && bonusPlaybackSpinsRef?.length) {
        isSpinning = false;
        syncControlsState();
        await runBonusSession(bonusEntry, b, m);
        return;
      }

      if (activeBookSession && getBookSessionPaid() > 0) {
        await settle(0, getBookSessionPaid(), { ...getWinSettleMeta(), recordBigWinOnly: true });
      }
    } catch {
      await loadBalance();
    } finally {
      waysTease.clear();
      scatterPlan.clear();
      isSpinning = false;
      syncControlsState();
    }
  }

  function changeBet(delta) {
    if (isSpinning) return;
    const idx = BET_STEPS.indexOf(bet);
    let next = idx < 0 ? 0 : idx + delta;
    next = Math.max(0, Math.min(BET_STEPS.length - 1, next));
    bet = BET_STEPS[next];
    updateHud(document.getElementById('winDisplay').textContent);
    updateBetNote();
  }

  function bindUi() {
    const modBtn = document.getElementById('modBtn');
    const modPanel = document.getElementById('modPanel');
    const modScatter3 = document.getElementById('modScatter3');
    const modScatter4 = document.getElementById('modScatter4');

    document.getElementById('spinBtn').addEventListener('click', () => {
      ensureBgMusicStarted();
      void doSpin();
    });
    document.getElementById('betUp').addEventListener('click', () => {
      ensureBgMusicStarted();
      changeBet(1);
    });
    document.getElementById('betDown').addEventListener('click', () => {
      ensureBgMusicStarted();
      changeBet(-1);
    });

    if (modBtn && modPanel) {
      modBtn.addEventListener('click', (e) => {
        ensureBgMusicStarted();
        e.stopPropagation();
        toggleModPanel();
      });
      document.addEventListener('click', (e) => {
        if (modPanel.style.display !== 'block') return;
        const target = e.target;
        if (modPanel.contains(target) || modBtn.contains(target)) return;
        closeModPanel();
      });
    }

    if (modScatter3) {
      modScatter3.addEventListener('click', (e) => {
        e.stopPropagation();
        setScatterMod(3);
      });
    }
    if (modScatter4) {
      modScatter4.addEventListener('click', (e) => {
        e.stopPropagation();
        setScatterMod(4);
      });
    }

    initTurboReelsToggle();

    const reelsFrame = document.querySelector('.reels-frame');
    if (reelsFrame) {
      reelsFrame.addEventListener('pointerdown', (e) => {
        if (!isSpinning || !spinSkipReady) return;
        if (e.target.closest('.leaderboard-btn, .turbo-reels-btn, button')) return;
        ensureBgMusicStarted();
        requestSpinFastForward();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      if (!isSpinning || !spinSkipReady) return;
      e.preventDefault();
      requestSpinFastForward();
    });

    const modBigWinTest = document.getElementById('modBigWinTest');
    if (modBigWinTest) {
      modBigWinTest.addEventListener('click', (e) => {
        e.stopPropagation();
        const multInp = document.getElementById('modBigWinMult');
        const nudgeInp = document.getElementById('modBigWinNudge');
        void debugShowBigWin(
          Number(multInp?.value) || 48,
          Number(nudgeInp?.value) || 1
        );
      });
    }

    const modBookQueue = document.getElementById('modBookQueue');
    const modBookRandom = document.getElementById('modBookRandom');
    const modBookSeed = document.getElementById('modBookSeed');
    const modBookIndex = document.getElementById('modBookIndex');

    if (modBookQueue) {
      modBookQueue.addEventListener('click', (e) => {
        e.stopPropagation();
        void (async () => {
          const seed = (modBookSeed?.value || '').trim();
          const idx = (modBookIndex?.value ?? '').trim();
          const key = seed || idx;
          if (!key) {
            alert('Введите seed или индекс книги (#0 …).');
            return;
          }
          if (!(await window.XbootBooks?.queueSeed(key))) {
            alert('Книга не найдена. Проверьте seed или индекс.');
            return;
          }
          if (modBookSeed) modBookSeed.value = '';
          if (modBookIndex) modBookIndex.value = '';
          updateBooksDebugHud('в очереди');
          closeModPanel();
        })();
      });
    }

    const modBookJackpot = document.getElementById('modBookJackpot');
    if (modBookJackpot) {
      modBookJackpot.addEventListener('click', (e) => {
        e.stopPropagation();
        void (async () => {
          if (!(await queueJackpotBook())) {
            alert('Джекпот-книга не найдена. npm run xboot-books-v2 && npm run xboot-books-server');
            return;
          }
          closeModPanel();
        })();
      });
    }

    if (modBookRandom) {
      modBookRandom.addEventListener('click', (e) => {
        e.stopPropagation();
        void (async () => {
          const entry = await window.XbootBooks?.pickRandom?.();
          if (!entry) {
            alert('Сервер книг недоступен.');
            return;
          }
          await window.XbootBooks?.queueSeed(entry.seed);
          updateBooksDebugHud('случайная');
          closeModPanel();
        })();
      });
    }
  }

  function preloadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  function preloadAudio(file) {
    return new Promise((resolve) => {
      const a = ensureSlotSoundCached(file);
      const done = () => resolve();
      if (a.readyState >= 4) {
        return resolve();
      }
      a.addEventListener('canplaythrough', done, { once: true });
      a.addEventListener('error', done, { once: true });
      a.load();
      setTimeout(done, 1200);
    });
  }

  async function preloadSlotAssets() {
    const imageTasks = SYMBOLS.map((sym) => preloadImage(symbolSrc(sym)));
    imageTasks.push(preloadImage(symbolSrc('nudge_target')));

    const audioFiles = [
      SOUND_BAM,
      SOUND_TRRR,
      SOUND_WIN,
      SOUND_WIN_OUT,
      SOUND_BOOM,
      SOUND_STOP,
      SOUND_SPIN,
      SOUND_SCATTER,
      SOUND_SCATTER3,
      SOUND_SCATTER4,
      SOUND_PRELUDE,
      SOUND_PRELUDE_TARGET,
      SOUND_TARGET,
      SOUND_NUDGE,
      SOUND_NUDGE_BAM,
      SOUND_NUDGE_SWAP,
      SOUND_BONUS3,
      SOUND_BONUS3_LOOP,
      SOUND_BONUS3_END,
      SOUND_BONUS3_END_2,
      SOUND_BONUS3_END_LOOP,
      SOUND_MAIN,
      SOUND_BONUS3_MAIN,
      SOUND_BONUS4_MAIN,
      WAYS_HIT_SOUNDS[3],
      WAYS_HIT_SOUNDS[4],
      WAYS_HIT_SOUNDS[5],
      WAYS_HIT_SOUNDS[6],
      SOUND_WIN_DEFAULT,
      SOUND_BZZZ,
      SOUND_WAYS,
      SOUND_XWAYS,
      SOUND_MAXWIN,
      SOUND_MAXWIN2
    ];

    const audioTasks = audioFiles.map((file) => {
      return preloadAudio(file);
    });

    await Promise.all([...imageTasks, ...audioTasks]);
  }

  async function init() {
    replayConfig = parseReplayConfig();
    replayMode = !!replayConfig;
    if (replayMode) {
      applyReplayModeUi();
      bindReplayContinue();
    }

    setSlotLoaderProgress(0.04, 'Инициализация…');
    resetTorpedoState();
    initBoard();
    buildReelsDom();
    initGoldRain();
    bindUi();
    bindLeaderboardUi();
    syncModUI();
    updateBetNote();

    setSlotLoaderProgress(0.12, 'Подключение к серверу книг…');
    await loadXbootBooks((p) => {
      setSlotLoaderProgress(0.12 + p * 0.38, 'Загрузка книг…');
    });

    setSlotLoaderProgress(0.55, 'Загрузка баланса…');
    await loadBalance();

    setSlotLoaderProgress(0.65, 'Загрузка ресурсов…');
    await preloadSlotAssets();

    setSlotLoaderProgress(1, replayMode ? 'Повтор готов' : 'Готово');
    updateHud('0.00');

    if (replayMode) {
      showReplayContinueButton();
    } else {
      hideSlotLoader();
    }
    notifySlotReady();

    bindBgMusicUnlock();

    window.addEventListener('resize', () => {
      updateResponsiveSlotSize();
    });

    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'XBOOT_SLOT_LAYOUT') {
        updateResponsiveSlotSize();
      }
      if (event.data?.type === 'XBOOT_PAUSE_AUDIO') {
        pauseAllSlotAudio();
      }
    });

    window.xbootShowBigWin = (winMult, nudgeMult = 1) =>
      debugShowBigWin(winMult, nudgeMult);

    window.xbootQueueBook = async (seedOrIndex) => {
      const ok = await window.XbootBooks?.queueSeed?.(seedOrIndex);
      updateBooksDebugHud(ok ? 'в очереди' : 'не найдено');
      return ok;
    };
    window.xbootQueueJackpot = () => queueJackpotBook();
    window.xbootGetBook = async (seedOrIndex) => {
      const raw = String(seedOrIndex ?? '').trim();
      if (/^\d+$/.test(raw)) return window.XbootBooks?.getByIndex?.(Number(raw));
      return window.XbootBooks?.getBySeed?.(raw);
    };
    window.xbootBooksStatus = () => window.XbootBooks?.getStore?.();

    const testMult = Number(qs.get('testBigWin'));
    const testNudge = Number(qs.get('nudgeMult') || qs.get('nudge'));
    if (!replayMode && testMult >= BIG_WIN_MIN_MULT) {
      setTimeout(
        () => void debugShowBigWin(testMult, testNudge > 1 ? testNudge : 1),
        600
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void init());
  } else {
    void init();
  }
})();
