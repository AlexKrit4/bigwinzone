"use client";

import { FormEvent, useState } from "react";
import type { AuthUser } from "@/components/AuthModal";

type WalletTab = "deposit" | "withdraw" | "promo";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError("");
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
      onBalance(data.balance);
      alert("Промокод активирован!");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
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
          Баланс: <strong>{user.balance.toFixed(2)}</strong>
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
              Оплата через ЮMoney. После перевода баланс обновится автоматически
              (1–2 минуты).
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
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" disabled={loading}>
              {loading ? "..." : "Создать заявку на вывод"}
            </button>
          </form>
        )}

        {tab === "promo" && (
          <form onSubmit={onPromo} className="auth-form">
            <label>
              Промокод
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
                required
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" disabled={loading}>
              {loading ? "..." : "Активировать"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
