/**
 * New Slot — xBoot-style UI, 5×4 grid (1024 ways), paytable at bet 1.00.
 * Wallet: shared CasinoWallet → /api/balance + /api/spin
 */
(function initNewSlot() {
  const NUM_REELS = 4;
  const ROWS = 4;
  const MIN_MATCH = 3;
  const MAX_WAYS = Math.pow(ROWS, NUM_REELS);

  const BET_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50, 100];

  /** Paytable at total bet 1.00 — scaled by bet in calculateWaysWin */
  const PAYOUTS = {
    high1: { 3: 0.5, 4: 0.75, 5: 1.0 },
    high2: { 3: 0.3, 4: 0.6, 5: 0.9 },
    high3: { 3: 0.3, 4: 0.6, 5: 0.9 },
    high4: { 3: 0.25, 4: 0.5, 5: 0.75 },
    high5: { 3: 0.25, 4: 0.5, 5: 0.75 },
    low1: { 3: 0.2, 4: 0.4, 5: 0.6 },
    low2: { 3: 0.2, 4: 0.4, 5: 0.6 },
    low3: { 3: 0.15, 4: 0.3, 5: 0.45 },
    low4: { 3: 0.1, 4: 0.2, 5: 0.4 },
    low5: { 3: 0.1, 4: 0.2, 5: 0.4 },
  };

  const PAYABLE = Object.keys(PAYOUTS);

  const SYMBOL_META = {
    high1: { tier: "high", glyph: "🦆", label: "Duck" },
    high2: { tier: "high", glyph: "🐰", label: "Bunny" },
    high3: { tier: "high", glyph: "🕶", label: "Lincoln" },
    high4: { tier: "high", glyph: "😷", label: "Wash." },
    high5: { tier: "high", glyph: "🎭", label: "Stalin" },
    low1: { tier: "low", glyph: "Aa", label: "AR-15" },
    low2: { tier: "low", glyph: "Kk", label: "Karen" },
    low3: { tier: "low", glyph: "Qq", label: "Qanada" },
    low4: { tier: "low", glyph: "Jj", label: "Joke" },
    low5: { tier: "low", glyph: "10", label: "Nine" },
  };

  const SPIN_DURATION = 1800;
  const REEL_STOP_STAGGER_MS = 220;
  const REEL_SPIN_SYMBOLS = 14;

  const els = {
    reelsGrid: document.getElementById("reelsGrid"),
    balance: document.getElementById("balanceDisplay"),
    bet: document.getElementById("betDisplay"),
    win: document.getElementById("winDisplay"),
    winLine: document.getElementById("winLine"),
    winOverlay: document.getElementById("winOverlay"),
    winOverlayAmount: document.getElementById("winOverlayAmount"),
    winOverlayLines: document.getElementById("winOverlayLines"),
    spinBtn: document.getElementById("spinBtn"),
    betDown: document.getElementById("betDown"),
    betUp: document.getElementById("betUp"),
    reelsFrame: document.querySelector(".reels-frame"),
  };

  let betIndex = BET_STEPS.indexOf(1);
  if (betIndex < 0) betIndex = 3;

  let spinning = false;
  let board = createEmptyBoard();
  let reelEls = [];

  function createEmptyBoard() {
    return Array.from({ length: NUM_REELS }, () =>
      Array.from({ length: ROWS }, () => PAYABLE[0]),
    );
  }

  function formatMoney(value) {
    return (Number(value) || 0).toFixed(2);
  }

  function currentBet() {
    return BET_STEPS[betIndex];
  }

  function randomSymbol() {
    return PAYABLE[Math.floor(Math.random() * PAYABLE.length)];
  }

  function randomBoard() {
    return Array.from({ length: NUM_REELS }, () =>
      Array.from({ length: ROWS }, () => randomSymbol()),
    );
  }

  function payKey(reelsMatched) {
    if (reelsMatched >= 5) return 5;
    return reelsMatched;
  }

  function countOnReel(sym, reel) {
    let count = 0;
    for (let row = 0; row < ROWS; row += 1) {
      if (board[reel][row] === sym) count += 1;
    }
    return count;
  }

  function calculateWaysWin(betAmt) {
    let totalWin = 0;
    let totalWays = 0;
    const wins = [];
    const highlightKeys = new Set();

    for (const sym of PAYABLE) {
      let reelsMatched = 0;
      let ways = 1;

      for (let reel = 0; reel < NUM_REELS; reel += 1) {
        const count = countOnReel(sym, reel);
        if (count === 0) break;
        reelsMatched += 1;
        ways *= count;
      }

      if (reelsMatched < MIN_MATCH) continue;

      const payTable = PAYOUTS[sym];
      const key = payKey(reelsMatched);
      const payMult = payTable[key] ?? payTable[5] ?? 0;
      const win = betAmt * payMult * ways;
      if (win <= 0) continue;

      wins.push({ sym, reelsMatched, ways, win });
      totalWin += win;
      totalWays += ways;

      for (let reel = 0; reel < reelsMatched; reel += 1) {
        for (let row = 0; row < ROWS; row += 1) {
          if (board[reel][row] !== sym) continue;
          highlightKeys.add(`${reel}:${row}`);
        }
      }
    }

    return {
      totalWin,
      totalWays,
      wins,
      highlights: [...highlightKeys].map((k) => {
        const [reel, row] = k.split(":").map(Number);
        return { reel, row };
      }),
    };
  }

  function createSymbolEl(sym) {
    const meta = SYMBOL_META[sym] || { tier: "low", glyph: "?", label: sym };
    const el = document.createElement("div");
    el.className = "symbol";
    el.dataset.symbol = sym;
    el.dataset.tier = meta.tier;

    const glyph = document.createElement("span");
    glyph.className = "sym-glyph";
    glyph.textContent = meta.glyph;

    const label = document.createElement("span");
    label.className = "sym-label";
    label.textContent = meta.label;

    el.appendChild(glyph);
    el.appendChild(label);
    return el;
  }

  function buildReelsGrid() {
    els.reelsGrid.innerHTML = "";
    els.reelsGrid.classList.remove("grid-4x4");
    reelEls = [];

    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      const col = document.createElement("div");
      col.className = "reel-col";
      col.dataset.reel = String(reel);

      const viewport = document.createElement("div");
      viewport.className = "reel-viewport";
      viewport.style.setProperty("--rows", String(ROWS));

      const content = document.createElement("div");
      content.className = "reel-content";

      for (let row = 0; row < ROWS; row += 1) {
        content.appendChild(createSymbolEl(board[reel][row]));
      }

      viewport.appendChild(content);
      col.appendChild(viewport);
      els.reelsGrid.appendChild(col);
      reelEls.push({ col, viewport, content });
    }
  }

  function renderBoard() {
    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      const { content } = reelEls[reel];
      content.innerHTML = "";
      for (let row = 0; row < ROWS; row += 1) {
        content.appendChild(createSymbolEl(board[reel][row]));
      }
    }
  }

  function clearHighlights() {
    els.reelsGrid.querySelectorAll(".symbol.win-highlight").forEach((node) => {
      node.classList.remove("win-highlight");
    });
  }

  function applyHighlights(highlights) {
    clearHighlights();
    for (const { reel, row } of highlights) {
      const symEl = reelEls[reel]?.content?.children[row];
      symEl?.classList.add("win-highlight");
    }
  }

  function updateHud(lastWin = null) {
    els.balance.textContent = formatMoney(CasinoWallet.getBalance());
    els.bet.textContent = formatMoney(currentBet());
    if (lastWin !== null) {
      els.win.textContent = formatMoney(lastWin);
    }
  }

  function setControlsEnabled(enabled) {
    els.spinBtn.disabled = !enabled;
    els.betDown.disabled = !enabled || betIndex <= 0;
    els.betUp.disabled = !enabled || betIndex >= BET_STEPS.length - 1;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function animateReelStop(reelIndex, targetSymbols) {
    const { content } = reelEls[reelIndex];
    const symH = content.querySelector(".symbol")?.offsetHeight || 80;

    for (let step = 0; step < REEL_SPIN_SYMBOLS; step += 1) {
      content.innerHTML = "";
      for (let row = 0; row < ROWS; row += 1) {
        const sym = step === REEL_SPIN_SYMBOLS - 1 ? targetSymbols[row] : randomSymbol();
        const node = createSymbolEl(sym);
        if (step < REEL_SPIN_SYMBOLS - 1) node.classList.add("spin-blur");
        content.appendChild(node);
      }
      content.style.transform = `translateY(-${(step % 3) * 4}px)`;
      await sleep(SPIN_DURATION / REEL_SPIN_SYMBOLS / 2);
    }

    content.style.transform = "";
    board[reelIndex] = targetSymbols.slice();
    content.innerHTML = "";
    for (let row = 0; row < ROWS; row += 1) {
      content.appendChild(createSymbolEl(board[reelIndex][row]));
    }
  }

  async function animateSpin(targetBoard) {
    clearHighlights();
    els.winOverlay.style.display = "none";
    els.winLine.textContent = "";

    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      await animateReelStop(reel, targetBoard[reel]);
      if (reel < NUM_REELS - 1) {
        await sleep(REEL_STOP_STAGGER_MS);
      }
    }
  }

  function describeWin(wins) {
    if (!wins.length) return "";
    const top = wins.slice().sort((a, b) => b.win - a.win)[0];
    const meta = SYMBOL_META[top.sym];
    return `${meta?.label || top.sym}: ${top.ways} way${top.ways === 1 ? "" : "s"} · ${formatMoney(top.win)}`;
  }

  function showWinOverlay(totalWin, totalWays) {
    els.winOverlayAmount.textContent = formatMoney(totalWin);
    els.winOverlayLines.textContent = `Ways: ${totalWays}`;
    els.winOverlay.style.display = "flex";
    els.winOverlay.classList.remove("exit");
  }

  async function handleSpin() {
    if (spinning) return;

    const bet = currentBet();
    if (CasinoWallet.getBalance() < bet) {
      alert("Недостаточно средств");
      return;
    }

    spinning = true;
    setControlsEnabled(false);
    els.win.textContent = "0.00";
    els.winLine.textContent = "";
    els.winOverlay.style.display = "none";

    try {
      await CasinoWallet.settleCasinoSpin(bet, 0);
    } catch (error) {
      alert(error.message || "Ошибка списания ставки");
      spinning = false;
      setControlsEnabled(true);
      updateHud(0);
      return;
    }

    updateHud(0);

    const targetBoard = randomBoard();
    await animateSpin(targetBoard);

    const result = calculateWaysWin(bet);
    applyHighlights(result.highlights);

    if (result.totalWin > 0) {
      try {
        await CasinoWallet.settleCasinoSpin(0, result.totalWin, { effectiveBet: bet });
      } catch (error) {
        console.error("[CASINO] credit failed:", error);
        els.winLine.textContent = "Ошибка зачисления выигрыша";
        spinning = false;
        setControlsEnabled(true);
        updateHud(0);
        return;
      }

      showWinOverlay(result.totalWin, result.totalWays);
      els.winLine.textContent = describeWin(result.wins);
    } else {
      els.winLine.textContent = "Без выигрыша";
    }

    spinning = false;
    setControlsEnabled(true);
    updateHud(result.totalWin);
  }

  function changeBet(delta) {
    if (spinning) return;
    betIndex = Math.max(0, Math.min(BET_STEPS.length - 1, betIndex + delta));
    setControlsEnabled(true);
    updateHud(Number(els.win.textContent) || 0);
  }

  function buildPaytableOverlay() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "paytable-btn";
    btn.textContent = "?";
    btn.title = "Таблица выплат";
    btn.setAttribute("aria-label", "Таблица выплат");

    const overlay = document.createElement("div");
    overlay.className = "paytable-overlay";
    overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "paytable-panel";
    panel.innerHTML = `
      <h2>Таблица выплат</h2>
      <p>Значения при общей ставке 1.00. Выигрыш = ставка × множитель × ways.</p>
    `;

    function addSection(title, symbols) {
      const section = document.createElement("div");
      section.className = "paytable-section";
      section.innerHTML = `<h3>${title}</h3>`;

      const head = document.createElement("div");
      head.className = "paytable-row paytable-row-head";
      head.innerHTML = "<span></span><span>Символ</span><span>×5</span><span>×4</span><span>×3</span>";
      section.appendChild(head);

      for (const sym of symbols) {
        const meta = SYMBOL_META[sym];
        const pay = PAYOUTS[sym];
        const row = document.createElement("div");
        row.className = "paytable-row";
        row.innerHTML = `
          <div class="paytable-swatch symbol" data-symbol="${sym}" data-tier="${meta.tier}">
            <span class="sym-glyph">${meta.glyph}</span>
          </div>
          <span>${meta.label}</span>
          <span>${pay[5].toFixed(2)}</span>
          <span>${pay[4].toFixed(2)}</span>
          <span>${pay[3].toFixed(2)}</span>
        `;
        section.appendChild(row);
      }

      panel.appendChild(section);
    }

    addSection("Presidant Symbols", ["high1", "high2", "high3", "high4", "high5"]);
    addSection("Alphabet Symbols", ["low1", "low2", "low3", "low4", "low5"]);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "paytable-close";
    close.textContent = "Закрыть";
    panel.appendChild(close);

    overlay.appendChild(panel);
    els.reelsFrame.appendChild(btn);
    document.body.appendChild(overlay);

    const open = () => {
      overlay.hidden = false;
    };
    const shut = () => {
      overlay.hidden = true;
    };

    btn.addEventListener("click", open);
    close.addEventListener("click", shut);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) shut();
    });
  }

  async function boot() {
    board = randomBoard();
    buildReelsGrid();
    buildPaytableOverlay();

    await CasinoWallet.loadCasinoBalance();
    updateHud(0);
    setControlsEnabled(true);

    els.spinBtn.addEventListener("click", () => {
      void handleSpin();
    });
    els.betDown.addEventListener("click", () => changeBet(-1));
    els.betUp.addEventListener("click", () => changeBet(1));
  }

  boot().catch((error) => {
    console.error("[NEW SLOT] boot failed:", error);
  });
})();
