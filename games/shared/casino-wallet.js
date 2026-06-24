/**
 * Shared casino wallet layer for static slot iframes.
 * Uses the same /api/balance + /api/spin contract as Rave and xBoot.
 */
(function initCasinoWallet(global) {
  const gameId = String(global.SLOT_GAME_ID || "newslot");
  const gameTitle = String(global.SLOT_GAME_TITLE || "New Slot");

  let balance = 0;
  let casinoApiAvailable = true;

  const CASINO_API = {
    async getBalance() {
      const response = await fetch("/api/balance", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const error = new Error(`Balance API failed: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return response.json();
    },

    async settleSpin(bet, win, meta = {}) {
      const response = await fetch("/api/spin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bet,
          win,
          game: gameId,
          gameTitle,
          ...meta,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `Spin API failed: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return data;
    },
  };

  function notifyCasinoBalanceChanged() {
    global.parent?.postMessage(
      { type: "CASINO_BALANCE_UPDATED", balance },
      global.location.origin,
    );
  }

  async function loadCasinoBalance() {
    try {
      const data = await CASINO_API.getBalance();
      balance = Number(data.balance) || 0;
      notifyCasinoBalanceChanged();
      return balance;
    } catch (error) {
      if (error && error.status === 401) {
        balance = 0;
        notifyCasinoBalanceChanged();
        alert("Войдите в аккаунт казино, чтобы играть на серверный баланс.");
        return balance;
      }

      casinoApiAvailable = false;
      console.warn("[CASINO] API недоступен, слот работает с локальным балансом.", error);
      return balance;
    }
  }

  async function settleCasinoSpin(bet, win, meta = {}) {
    if (!casinoApiAvailable) return { balance };

    const data = await CASINO_API.settleSpin(bet, win, meta);
    balance = Number(data.balance) || 0;
    notifyCasinoBalanceChanged();
    return data;
  }

  global.CasinoWallet = {
    getBalance() {
      return balance;
    },
    setBalance(value) {
      balance = Number(value) || 0;
    },
    isCasinoApiAvailable() {
      return casinoApiAvailable;
    },
    loadCasinoBalance,
    settleCasinoSpin,
    notifyCasinoBalanceChanged,
    getGameId() {
      return gameId;
    },
    getGameTitle() {
      return gameTitle;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
