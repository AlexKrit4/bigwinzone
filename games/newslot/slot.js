/**
 * New Slot — 5×4 cascade / gravity, 1024 ways, paytable at bet 1.00.
 * Book (random for now) → drop in → win → remove → gravity → refill → repeat.
 */
(function initNewSlot() {
  const NUM_REELS = 5;
  const ROWS = 4;
  const MIN_MATCH = 3;

  const BET_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50, 100];

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

  const DROP_MS = 420;
  const DROP_STAGGER_MS = 48;
  const COL_STAGGER_MS = 80;
  const REMOVE_MS = 280;
  const CASCADE_PAUSE_MS = 320;
  const WIN_HIGHLIGHT_MS = 420;

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
  /** @type {string[][]} row 0 = top */
  let board = createEmptyBoard();
  /** @type {HTMLElement[][]} */
  let colEls = [];
  /** @type {HTMLElement[][]} */
  let cellEls = [];
  /** @type {Map<string, HTMLElement>} id → symbol wrapper */
  let symbolNodes = new Map();
  let symStepPx = 80;

  function createEmptyBoard() {
    return Array.from({ length: NUM_REELS }, () => Array.from({ length: ROWS }, () => null));
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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function measureSymStep() {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--sym-h);width:0";
    els.reelsGrid.appendChild(probe);
    symStepPx = probe.offsetHeight || 80;
    probe.remove();
  }

  /** Stub book — later from books-server */
  function pickBook() {
    return {
      id: `rnd_${Date.now().toString(36)}`,
      initial: Array.from({ length: NUM_REELS }, () =>
        Array.from({ length: ROWS }, () => randomSymbol()),
      ),
      refill: () => randomSymbol(),
    };
  }

  function payKey(reelsMatched) {
    return Math.min(reelsMatched, 5);
  }

  function countOnReel(sym, reel) {
    let count = 0;
    for (let row = 0; row < ROWS; row += 1) {
      if (board[reel][row] === sym) count += 1;
    }
    return count;
  }

  function boardIsFull() {
    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        if (!board[reel][row]) return false;
      }
    }
    return true;
  }

  function calculateWaysWin(betAmt) {
    let totalWin = 0;
    let totalWays = 0;
    const wins = [];
    const highlightKeys = new Set();

    if (!boardIsFull()) {
      return { totalWin: 0, totalWays: 0, wins: [], highlights: [] };
    }

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
      const payMult = payTable[payKey(reelsMatched)] ?? 0;
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
    const wrap = document.createElement("div");
    wrap.className = "cascade-symbol";

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
    wrap.appendChild(el);
    return wrap;
  }

  function symbolId(reel, row) {
    return `${reel}:${row}`;
  }

  function buildCascadeGrid() {
    els.reelsGrid.innerHTML = "";
    els.reelsGrid.classList.add("cascade-grid");
    colEls = [];
    cellEls = [];
    symbolNodes.clear();

    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      const col = document.createElement("div");
      col.className = "cascade-col";
      col.dataset.reel = String(reel);
      const cells = [];

      for (let row = 0; row < ROWS; row += 1) {
        const cell = document.createElement("div");
        cell.className = "cascade-cell";
        cell.dataset.row = String(row);
        col.appendChild(cell);
        cells.push(cell);
      }

      els.reelsGrid.appendChild(col);
      colEls.push(col);
      cellEls.push(cells);
    }

    measureSymStep();
  }

  function mountSymbol(reel, row, sym, yOffsetPx) {
    const id = symbolId(reel, row);
    
    // Safety cleanup if a node somehow got stuck here
    const existing = symbolNodes.get(id);
    if (existing) existing.remove();

    const node = createSymbolEl(sym);
    node.dataset.id = id;
    node.style.transform = `translateY(${yOffsetPx}px)`;
    cellEls[reel][row].appendChild(node);
    symbolNodes.set(id, node);
    return node;
  }

  function clearAllSymbols() {
    symbolNodes.forEach((node) => node.remove());
    symbolNodes.clear();
  }

  function setSymbolTransform(reel, row, yPx, animate) {
    const node = symbolNodes.get(symbolId(reel, row));
    if (!node) return;
    node.classList.toggle("is-dropping", animate);
    node.style.transform = `translateY(${yPx}px)`;
  }

  async function waitTransition(node) {
    if (!node) return;
    await new Promise((resolve) => {
      const done = () => {
        node.removeEventListener("transitionend", onEnd);
        resolve();
      };
      const onEnd = (event) => {
        if (event.propertyName === "transform" || event.propertyName === "opacity") done();
      };
      node.addEventListener("transitionend", onEnd);
      setTimeout(done, DROP_MS + 120);
    });
  }

  function syncBoardToDomPositions() {
    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const sym = board[reel][row];
        const id = symbolId(reel, row);
        let node = symbolNodes.get(id);
        if (!sym) {
          node?.remove();
          symbolNodes.delete(id);
          continue;
        }
        if (!node) {
          node = mountSymbol(reel, row, sym, 0);
        } else {
          const inner = node.querySelector(".symbol");
          if (inner) {
            inner.dataset.symbol = sym;
            inner.dataset.tier = SYMBOL_META[sym]?.tier || "low";
            inner.querySelector(".sym-glyph").textContent = SYMBOL_META[sym]?.glyph || "?";
            inner.querySelector(".sym-label").textContent = SYMBOL_META[sym]?.label || sym;
          }
        }
        setSymbolTransform(reel, row, 0, false);
      }
    }
  }

  async function animateClearBoard() {
    const tasks = [];
    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      for (let row = ROWS - 1; row >= 0; row -= 1) {
        const node = symbolNodes.get(symbolId(reel, row));
        if (node) {
          tasks.push((async () => {
            await sleep(reel * COL_STAGGER_MS + (ROWS - 1 - row) * DROP_STAGGER_MS);
            setNodeTransform(node, ROWS * symStepPx, true);
            await waitTransition(node);
            node.remove();
          })());
        }
      }
    }
    await Promise.all(tasks);
    
    // Ensure absolutely everything is cleaned up from DOM and Map
    symbolNodes.forEach((node) => node.remove());
    symbolNodes.clear();
    board = createEmptyBoard();
  }

  async function animateInitialDrop(bookBoard) {
    const tasks = [];

    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const sym = bookBoard[reel][row];
        board[reel][row] = sym;
        const spawnOffset = -ROWS * symStepPx;
        const node = mountSymbol(reel, row, sym, spawnOffset);
        node.offsetHeight; // Force reflow
      }
    }

    await sleep(COL_STAGGER_MS * 0.5);

    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      for (let row = ROWS - 1; row >= 0; row -= 1) {
        const node = symbolNodes.get(symbolId(reel, row));
        tasks.push(
          (async () => {
            await sleep(reel * COL_STAGGER_MS + (ROWS - 1 - row) * DROP_STAGGER_MS);
            setNodeTransform(node, 0, true);
            await waitTransition(node);
            node?.classList.remove("is-dropping");
          })(),
        );
      }
    }

    await Promise.all(tasks);
  }

  function applyGravityColumn(reel) {
    const remaining = board[reel].filter((sym) => sym != null);
    const emptyCount = ROWS - remaining.length;
    for (let row = 0; row < ROWS; row += 1) {
      board[reel][row] = row < emptyCount ? null : remaining[row - emptyCount];
    }
  }

  function setNodeTransform(node, yPx, animate) {
    if (!node) return;
    node.style.transition = animate 
      ? "transform 0.42s cubic-bezier(0.34, 1.05, 0.48, 1), opacity 0.24s ease"
      : "none";
    node.style.transform = `translateY(${yPx}px)`;
  }

  async function animateGravityColumn(reel) {
    const moving = [];
    for (let row = 0; row < ROWS; row += 1) {
      const sym = board[reel][row];
      if (!sym) continue;
      moving.push({
        fromRow: row,
        node: symbolNodes.get(symbolId(reel, row)),
      });
    }

    applyGravityColumn(reel);

    const emptyTop = ROWS - moving.length;
    const moves = [];

    // Calculate moves
    moving.forEach((item, index) => {
      const toRow = emptyTop + index;
      if (item.fromRow !== toRow && item.node) {
        moves.push({ ...item, toRow });
      }
    });

    // Delete old keys first to avoid overwriting conflicts
    for (const { fromRow } of moves) {
      symbolNodes.delete(symbolId(reel, fromRow));
    }

    // Set new keys and move DOM nodes
    for (const { toRow, node } of moves) {
      const newId = symbolId(reel, toRow);
      symbolNodes.set(newId, node);
      node.dataset.id = newId;
      cellEls[reel][toRow].appendChild(node);
    }

    // Animate
    const tasks = moves.map(async ({ fromRow, toRow, node }) => {
      const delta = (fromRow - toRow) * symStepPx;
      setNodeTransform(node, delta, false);
      node.offsetHeight; // Force reflow
      await sleep(16);
      setNodeTransform(node, 0, true);
      await waitTransition(node);
      node.classList.remove("is-dropping");
    });

    await Promise.all(tasks);
  }

  async function animateGravityAll() {
    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      await animateGravityColumn(reel);
    }
  }

  function removeWinningCells(highlights) {
    for (const { reel, row } of highlights) {
      board[reel][row] = null;
    }
  }

  async function animateRemoveWinners(highlights) {
    const tasks = highlights.map(async ({ reel, row }) => {
      const node = symbolNodes.get(symbolId(reel, row));
      if (!node) return;
      node.querySelector(".symbol")?.classList.add("win-highlight");
      await sleep(WIN_HIGHLIGHT_MS);
      node.style.transition = "opacity 0.26s ease, transform 0.26s ease";
      node.style.opacity = "0";
      node.style.transform = "scale(0.82)";
      await waitTransition(node);
      node.remove();
      symbolNodes.delete(symbolId(reel, row));
    });
    await Promise.all(tasks);
  }

  async function refillColumn(reel, refillFn) {
    const emptyRows = [];
    for (let row = 0; row < ROWS; row += 1) {
      if (board[reel][row] == null) emptyRows.push(row);
    }
    if (!emptyRows.length) return;

    const tasks = emptyRows.map(async (row, index) => {
      const sym = refillFn();
      board[reel][row] = sym;
      const spawnOffset = -ROWS * symStepPx; // Start from above the board
      const node = mountSymbol(reel, row, sym, spawnOffset);
      node.offsetHeight; // Force reflow
      
      const reverseIndex = emptyRows.length - 1 - index;
      await sleep(reverseIndex * DROP_STAGGER_MS + 16);
      setNodeTransform(node, 0, true);
      await waitTransition(node);
      node.classList.remove("is-dropping");
    });

    await Promise.all(tasks);
  }

  async function refillAll(refillFn) {
    for (let reel = 0; reel < NUM_REELS; reel += 1) {
      await refillColumn(reel, refillFn);
      await sleep(COL_STAGGER_MS * 0.35);
    }
  }

  function clearWinHighlights() {
    els.reelsGrid.querySelectorAll(".symbol.win-highlight").forEach((node) => {
      node.classList.remove("win-highlight");
    });
  }

  function updateHud(sessionWin = null) {
    els.balance.textContent = formatMoney(CasinoWallet.getBalance());
    els.bet.textContent = formatMoney(currentBet());
    if (sessionWin !== null) {
      els.win.textContent = formatMoney(sessionWin);
    }
  }

  function setControlsEnabled(enabled) {
    els.spinBtn.disabled = !enabled;
    els.betDown.disabled = !enabled || betIndex <= 0;
    els.betUp.disabled = !enabled || betIndex >= BET_STEPS.length - 1;
  }

  function describeWin(wins) {
    if (!wins.length) return "";
    const top = wins.slice().sort((a, b) => b.win - a.win)[0];
    const meta = SYMBOL_META[top.sym];
    return `${meta?.label || top.sym}: ${top.ways} way${top.ways === 1 ? "" : "s"} · +${formatMoney(top.win)}`;
  }

  function showWinOverlay(totalWin, totalWays) {
    els.winOverlayAmount.textContent = formatMoney(totalWin);
    els.winOverlayLines.textContent = `Ways: ${totalWays}`;
    els.winOverlay.style.display = "flex";
    els.winOverlay.classList.remove("exit");
  }

  async function runCascadeLoop(bet, refillFn) {
    let totalWin = 0;
    let totalWays = 0;
    let cascade = 0;

    while (true) {
      const result = calculateWaysWin(bet);
      if (result.totalWin <= 0) break;

      cascade += 1;
      totalWin += result.totalWin;
      totalWays += result.totalWays;

      els.winLine.textContent = `#${cascade} ${describeWin(result.wins)} · total ${formatMoney(totalWin)}`;
      updateHud(totalWin);

      await animateRemoveWinners(result.highlights);
      removeWinningCells(result.highlights);
      await sleep(CASCADE_PAUSE_MS * 0.4);

      await animateGravityAll();
      await sleep(CASCADE_PAUSE_MS * 0.35);

      await refillAll(refillFn);
      await sleep(CASCADE_PAUSE_MS * 0.35);
    }

    return { totalWin, totalWays, cascade };
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
    els.winLine.innerHTML = "&nbsp;";
    els.winOverlay.style.display = "none";
    clearWinHighlights();

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

    const book = pickBook();
    els.winLine.textContent = "Падают символы…";
    await animateClearBoard();
    await animateInitialDrop(book.initial);

    const { totalWin, totalWays, cascade } = await runCascadeLoop(bet, book.refill);

    if (totalWin > 0) {
      try {
        await CasinoWallet.settleCasinoSpin(0, totalWin, { effectiveBet: bet });
      } catch (error) {
        console.error("[CASINO] credit failed:", error);
        els.winLine.textContent = "Ошибка зачисления выигрыша";
        spinning = false;
        setControlsEnabled(true);
        updateHud(0);
        return;
      }

      showWinOverlay(totalWin, totalWays);
      els.winLine.textContent =
        cascade > 1
          ? `${cascade} каскада · ${formatMoney(totalWin)}`
          : `${formatMoney(totalWin)}`;
    } else {
      els.winLine.textContent = "Без выигрыша";
    }

    spinning = false;
    setControlsEnabled(true);
    updateHud(totalWin);
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
      <p>Ставка 1.00. Выигрыш = ставка × множитель × ways. Каскады суммируются.</p>
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

    btn.addEventListener("click", () => {
      overlay.hidden = false;
    });
    close.addEventListener("click", () => {
      overlay.hidden = true;
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.hidden = true;
    });
  }

  async function boot() {
    buildCascadeGrid();
    buildPaytableOverlay();

    board = Array.from({ length: NUM_REELS }, () =>
      Array.from({ length: ROWS }, () => randomSymbol()),
    );
    syncBoardToDomPositions();

    await CasinoWallet.loadCasinoBalance();
    updateHud(0);
    setControlsEnabled(true);

    els.spinBtn.addEventListener("click", () => {
      void handleSpin();
    });
    els.betDown.addEventListener("click", () => changeBet(-1));
    els.betUp.addEventListener("click", () => changeBet(1));

    window.addEventListener("resize", () => {
      measureSymStep();
    });
  }

  boot().catch((error) => {
    console.error("[NEW SLOT] boot failed:", error);
  });
})();
