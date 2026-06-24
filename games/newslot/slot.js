/**
 * New Slot — placeholder game logic.
 * Wallet settlement uses the shared CasinoWallet module (same as Rave / xBoot).
 * Replace resolvePlaceholderOutcome() when game rules are ready.
 */

const BET_STEPS = [0.2, 0.4, 0.6, 0.8, 1, 2, 4, 6, 8, 10, 20, 40, 60, 80, 100];
const SYMBOLS = ["A", "K", "Q", "J", "10", "7"];

const els = {
  balance: document.getElementById("balanceValue"),
  bet: document.getElementById("betValue"),
  win: document.getElementById("winValue"),
  status: document.getElementById("statusLine"),
  spinBtn: document.getElementById("spinBtn"),
  betDown: document.getElementById("betDown"),
  betUp: document.getElementById("betUp"),
  reels: Array.from(document.querySelectorAll(".reel")),
};

let betIndex = BET_STEPS.indexOf(1);
if (betIndex < 0) betIndex = 0;

let spinning = false;
let lastWin = 0;

function formatMoney(value) {
  return (Number(value) || 0).toFixed(2);
}

function currentBet() {
  return BET_STEPS[betIndex];
}

function updateHud() {
  els.balance.textContent = formatMoney(CasinoWallet.getBalance());
  els.bet.textContent = formatMoney(currentBet());
  els.win.textContent = formatMoney(lastWin);
}

function setControlsEnabled(enabled) {
  els.spinBtn.disabled = !enabled;
  els.betDown.disabled = !enabled || betIndex <= 0;
  els.betUp.disabled = !enabled || betIndex >= BET_STEPS.length - 1;
}

function pickSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

/**
 * Temporary outcome logic until real rules arrive.
 * Returns { symbols: string[3], win: number } where win is in money units.
 */
function resolvePlaceholderOutcome(bet) {
  const symbols = [pickSymbol(), pickSymbol(), pickSymbol()];
  const allSame = symbols[0] === symbols[1] && symbols[1] === symbols[2];
  const win = allSame ? bet * 5 : 0;
  return { symbols, win };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animateSpin(symbols, win) {
  els.reels.forEach((reel) => reel.classList.add("spinning"));
  els.status.textContent = "Крутим…";

  for (let step = 0; step < 8; step += 1) {
    els.reels.forEach((reel) => {
      reel.querySelector("span").textContent = pickSymbol();
    });
    await sleep(80);
  }

  els.reels.forEach((reel, index) => {
    reel.classList.remove("spinning");
    reel.classList.toggle("win", win > 0);
    reel.querySelector("span").textContent = symbols[index];
  });

  if (win > 0) {
    els.status.textContent = `Выигрыш ${formatMoney(win)}`;
  } else {
    els.status.textContent = "Без выигрыша";
  }
}

async function handleSpin() {
  if (spinning) return;

  const bet = currentBet();
  if (CasinoWallet.getBalance() < bet) {
    alert("Недостаточно средств");
    return;
  }

  spinning = true;
  lastWin = 0;
  setControlsEnabled(false);
  updateHud();

  try {
    await CasinoWallet.settleCasinoSpin(bet, 0);
  } catch (error) {
    console.error("[CASINO] Ошибка списания ставки:", error);
    alert(error.message || "Ошибка списания ставки. Попробуйте ещё раз.");
    spinning = false;
    setControlsEnabled(true);
    updateHud();
    return;
  }

  const outcome = resolvePlaceholderOutcome(bet);
  await animateSpin(outcome.symbols, outcome.win);

  if (outcome.win > 0) {
    try {
      await CasinoWallet.settleCasinoSpin(0, outcome.win, { effectiveBet: bet });
      lastWin = outcome.win;
    } catch (error) {
      console.error("[CASINO] Ошибка зачисления выигрыша:", error);
      els.status.textContent = "Ошибка зачисления выигрыша";
    }
  }

  spinning = false;
  setControlsEnabled(true);
  updateHud();
}

function changeBet(delta) {
  if (spinning) return;
  betIndex = Math.max(0, Math.min(BET_STEPS.length - 1, betIndex + delta));
  setControlsEnabled(true);
  updateHud();
}

async function boot() {
  await CasinoWallet.loadCasinoBalance();
  updateHud();
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
