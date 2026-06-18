"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/components/AuthModal";
import type { BalanceParts } from "@/components/BalanceBreakdown";
import { WinTitleBar } from "@/components/WinTitleBar";

type DepositRow = {
  id: string;
  amount: number;
  bonusAmount: number;
  status: string;
  promoCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

type WithdrawalRow = {
  id: string;
  amount: number;
  payoutTo: string;
  status: string;
  createdAt: string;
};

type PromoRow = {
  id: string;
  code: string;
  isAdminGrant?: boolean;
  status: string;
  depositBonusPercent: number;
  wagerMultiplier: number;
  depositAmount: number;
  bonusAmount: number;
  wagerRequired: number;
  wagerProgress: number;
  progressPercent: number;
};

type ProfileModalProps = {
  user: AuthUser;
  onClose: () => void;
  onBalancesUpdate?: (data: Partial<BalanceParts>) => void;
};

export function ProfileModal({ user, onClose, onBalancesUpdate }: ProfileModalProps) {
  const [tab, setTab] = useState<"deposits" | "withdrawals" | "promos">("promos");
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setDeposits(data.deposits ?? []);
      setWithdrawals(data.withdrawals ?? []);
      setPromos(data.promos ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelPromo(p: PromoRow) {
    const msg =
      p.bonusAmount > 0 && p.status === "WAGERING"
        ? p.isAdminGrant
          ? `Отменить бонус ${p.code}? С баланса спишется ${p.bonusAmount.toFixed(2)} ₽.`
          : `Отменить ${p.code}? С баланса спишется ${p.bonusAmount.toFixed(2)} ₽ бонуса.`
        : `Отменить промокод ${p.code}?`;
    if (!confirm(msg)) return;

    setError("");
    const res = await fetch(
      `/api/wallet/promo?activationId=${encodeURIComponent(p.id)}`,
      { method: "DELETE", credentials: "include" },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось отменить");
      return;
    }
    onBalancesUpdate?.(data);
    load();
  }

  const activePromos = promos.filter(
    (p) => p.status === "WAITING_DEPOSIT" || p.status === "WAGERING",
  );

  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true">
      <div className="auth-modal profile-modal win-window">
        <WinTitleBar title="Профиль.exe" />
        <div className="win-body">
          <button className="modal-x win-chrome-btn win-chrome-btn--close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <p className="eyebrow">Игрок BWZ</p>
          <h2>{user.username}</h2>
          <p className="wallet-balance-line">
            На счёте: <strong>{user.balance.toFixed(2)} ₽</strong>
          </p>
          <ul className="balance-breakdown-inline">
            <li>Основной: {(user.cash ?? user.balance).toFixed(2)} ₽</li>
            <li>Бонусы: {(user.bonus ?? 0).toFixed(2)} ₽</li>
            <li>К депозиту: {(user.promoDeposit ?? 0).toFixed(2)} ₽</li>
          </ul>

        <div className="wallet-tabs">
          <button
            type="button"
            className={tab === "promos" ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab("promos")}
          >
            Промо
          </button>
          <button
            type="button"
            className={tab === "deposits" ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab("deposits")}
          >
            Депозиты
          </button>
          <button
            type="button"
            className={tab === "withdrawals" ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab("withdrawals")}
          >
            Выводы
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {loading ? (
          <p className="wallet-hint">Загрузка...</p>
        ) : (
          <>
            {tab === "promos" && (
              <div className="profile-section">
                {activePromos.length === 0 ? (
                  <p className="wallet-hint">Нет активных промокодов.</p>
                ) : (
                  activePromos.map((p) => (
                    <div key={p.id} className="promo-progress-card">
                      <div className="promo-progress-head">
                        <strong>{p.code}</strong>
                        <span className="promo-status">
                          {statusLabel(p.status, p.isAdminGrant)}
                        </span>
                      </div>
                      <p className="wallet-hint">
                        {p.isAdminGrant
                          ? `Бонус от администрации · вейджер ×${p.wagerMultiplier}`
                          : `+${p.depositBonusPercent}% к депозиту · вейджер ×${p.wagerMultiplier}`}
                      </p>
                      {p.status === "WAGERING" && (
                        <>
                          <div className="progress-bar">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${p.progressPercent}%` }}
                            />
                          </div>
                          <p className="progress-label">
                            Отыграно {p.wagerProgress.toFixed(2)} /{" "}
                            {p.wagerRequired.toFixed(2)} ₽ ({p.progressPercent}%)
                          </p>
                          <p className="wallet-hint">
                            Депозит {p.depositAmount.toFixed(2)} + бонус{" "}
                            {p.bonusAmount.toFixed(2)} ₽
                          </p>
                        </>
                      )}
                      {p.status === "WAITING_DEPOSIT" && (
                        <p className="wallet-hint">
                          Активирован — сделайте депозит, чтобы получить бонус.
                        </p>
                      )}
                      <button
                        type="button"
                        className="ghost-btn promo-cancel-btn"
                        onClick={() => void cancelPromo(p)}
                      >
                        Отменить промокод
                      </button>
                    </div>
                  ))
                )}
                {promos.filter((p) => p.status === "COMPLETED").length > 0 && (
                  <>
                    <h3 className="profile-subtitle">Завершённые</h3>
                    {promos
                      .filter((p) => p.status === "COMPLETED")
                      .map((p) => (
                        <p key={p.id} className="wallet-hint">
                          {p.code} — отыграно ✓
                        </p>
                      ))}
                  </>
                )}
              </div>
            )}

            {tab === "deposits" && (
              <ul className="profile-list">
                {deposits.length === 0 ? (
                  <li className="wallet-hint">Депозитов пока нет</li>
                ) : (
                  deposits.map((d) => (
                    <li key={d.id}>
                      <span>{new Date(d.createdAt).toLocaleString("ru-RU")}</span>
                      <span>
                        {d.amount.toFixed(2)} ₽
                        {d.bonusAmount > 0
                          ? ` +${d.bonusAmount.toFixed(2)} бонус`
                          : ""}
                      </span>
                      <span className="profile-meta">
                        {d.status}
                        {d.promoCode ? ` · ${d.promoCode}` : ""}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}

            {tab === "withdrawals" && (
              <ul className="profile-list">
                {withdrawals.length === 0 ? (
                  <li className="wallet-hint">Выводов пока нет</li>
                ) : (
                  withdrawals.map((w) => (
                    <li key={w.id}>
                      <span>{new Date(w.createdAt).toLocaleString("ru-RU")}</span>
                      <span>{w.amount.toFixed(2)} ₽ → {w.payoutTo}</span>
                      <span className="profile-meta">{w.status}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string, isAdminGrant?: boolean) {
  if (status === "WAITING_DEPOSIT") return "Ждёт депозит";
  if (status === "WAGERING") return isAdminGrant ? "Бонус · отыгрыш" : "Отыгрыш";
  if (status === "COMPLETED") return "Готово";
  return status;
}
