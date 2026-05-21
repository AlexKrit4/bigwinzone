"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AuthUser } from "@/components/AuthModal";

type WalletTab = "deposit" | "withdraw" | "promo";

type PendingPromo = {
  id: string;
  code: string;
  depositBonusPercent: number;
  wagerMultiplier: number;
  hint?: string;
};

type WageringPromo = {
  id: string;
  code: string;
  bonusAmount: number;
  wagerProgress: number;
  wagerRequired: number;
};

type WalletModalProps = {
  user: AuthUser;
  initialTab?: WalletTab;
  onClose: () => void;
  onBalance: (balance: number) => void;
};

export function WalletModal({
  user,
  initialTab = "deposit",
  onClose,
  onBalance,
}: WalletModalProps) {
  const [tab, setTab] = useState<WalletTab>(initialTab);
  const [amount, setAmount] = useState("500");
  const [payoutTo, setPayoutTo] = useState("");
  const [note, setNote] = useState("");
  const [promo, setPromo] = useState("");
  const [pendingPromo, setPendingPromo] = useState<PendingPromo | null>(null);
  const [wageringPromos, setWageringPromos] = useState<WageringPromo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPendingPromo() {
    const res = await fetch("/api/wallet/promo", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setPendingPromo(data.pending ?? null);
    setWageringPromos(data.wagering ?? []);
  }

  useEffect(() => {
    loadPendingPromo();
  }, []);

  async function onDeposit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка депозита");
      if (data.promo) setPendingPromo(data.promo);
      if (data.label) {
        sessionStorage.setItem("pendingDepositLabel", data.label);
      }
      window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function onWithdraw(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          payoutTo,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка вывода");
      onBalance(data.balance);
      alert("Заявка на вывод создана. Ожидайте обработки.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function onPromo(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/promo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка промокода");
      setPendingPromo(data.pending);
      setPromo("");
      setTab("deposit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function cancelPromo(activationId: string, bonusAmount = 0) {
    const msg =
      bonusAmount > 0
        ? `Отменить промокод? С баланса спишется ${bonusAmount.toFixed(2)} ₽ бонуса.`
        : "Отменить промокод?";
    if (!confirm(msg)) return;

    setError("");
    const res = await fetch(
      `/api/wallet/promo?activationId=${encodeURIComponent(activationId)}`,
      { method: "DELETE", credentials: "include" },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось отменить");
      return;
    }
    setPendingPromo(null);
    setWageringPromos((list) => list.filter((w) => w.id !== activationId));
    if (typeof data.balance === "number") onBalance(data.balance);
    await loadPendingPromo();
  }

  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true">
      <div className="auth-modal wallet-modal">
        <button className="modal-x" onClick={onClose} aria-label="Закрыть">
          x
        </button>
        <p className="eyebrow">Кошелёк</p>
        <h2>{user.username}</h2>
        <p className="wallet-balance-line">
          Баланс: <strong>{user.balance.toFixed(2)} ₽</strong>
        </p>

        <div className="wallet-tabs">
          <button
            type="button"
            className={tab === "deposit" ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab("deposit")}
          >
            Депозит
          </button>
          <button
            type="button"
            className={tab === "withdraw" ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab("withdraw")}
          >
            Вывод
          </button>
          <button
            type="button"
            className={tab === "promo" ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab("promo")}
          >
            Промокод
          </button>
        </div>

        {tab === "deposit" && (
          <form onSubmit={onDeposit} className="auth-form">
            {pendingPromo && (
              <div className="promo-pending-banner">
                <strong>{pendingPromo.code}</strong>: +{pendingPromo.depositBonusPercent}%
                к депозиту, отыгрыш ×{pendingPromo.wagerMultiplier}
                <button
                  type="button"
                  className="ghost-btn promo-cancel-btn"
                  onClick={() => void cancelPromo(pendingPromo.id)}
                >
                  Отменить
                </button>
              </div>
            )}
            <label>
              Сумма (₽), мин. 50
              <input
                type="number"
                min={50}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <p className="wallet-hint">
              Оплата через ЮMoney. Бонус по промокоду начислится после зачисления
              депозита.
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" disabled={loading}>
              {loading ? "..." : "Перейти к оплате ЮMoney"}
            </button>
          </form>
        )}

        {tab === "withdraw" && (
          <form onSubmit={onWithdraw} className="auth-form">
            <label>
              Сумма (₽), мин. 100
              <input
                type="number"
                min={100}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Кошелёк / телефон ЮMoney
              <input
                value={payoutTo}
                onChange={(e) => setPayoutTo(e.target.value)}
                placeholder="41001... или +79..."
                required
              />
            </label>
            <label>
              Комментарий (необязательно)
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <p className="wallet-hint">
              Вывод недоступен, пока не отыгран активный бонус по промокоду.
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" disabled={loading}>
              {loading ? "..." : "Создать заявку на вывод"}
            </button>
          </form>
        )}

        {wageringPromos.length > 0 && tab !== "withdraw" && (
          <div className="promo-pending-banner">
            {wageringPromos.map((w) => (
              <div key={w.id} className="promo-wagering-row">
                <span>
                  <strong>{w.code}</strong> — бонус {w.bonusAmount.toFixed(2)} ₽, отыгрыш{" "}
                  {w.wagerProgress.toFixed(0)}/{w.wagerRequired.toFixed(0)} ₽
                </span>
                <button
                  type="button"
                  className="ghost-btn promo-cancel-btn"
                  onClick={() => void cancelPromo(w.id, w.bonusAmount)}
                >
                  Отменить
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "promo" && (
          <form onSubmit={onPromo} className="auth-form">
            <label>
              Промокод к депозиту
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
                required
              />
            </label>
            <p className="wallet-hint">
              Сначала активируйте код, затем пополните баланс. Бонус % начислится
              автоматически. Сумму ставок нужно отыграть перед выводом.
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" disabled={loading}>
              {loading ? "..." : "Привязать к депозиту"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
