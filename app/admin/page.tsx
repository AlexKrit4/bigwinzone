"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Stats = {
  usersCount: number;
  totalBalance: number;
  pendingWithdrawals: number;
  depositsTotal: number;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: number;
  createdAt: string;
};

type DepositRow = {
  id: string;
  username: string;
  amount: number;
  bonusAmount: number;
  status: string;
  externalId: string | null;
  createdAt: string;
  completedAt: string | null;
};

type WithdrawalRow = {
  id: string;
  username: string;
  amount: number;
  payoutTo: string;
  status: string;
  userNote: string | null;
  adminNote: string | null;
  createdAt: string;
};

type PromoRow = {
  id: string;
  code: string;
  depositBonusPercent: number;
  wagerMultiplier: number;
  usedCount: number;
  maxUses: number | null;
  active: boolean;
};

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [msg, setMsg] = useState("");

  const [grantUser, setGrantUser] = useState("");
  const [grantAmount, setGrantAmount] = useState("100");
  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState("100");
  const [promoWager, setPromoWager] = useState("3");
  const [promoMax, setPromoMax] = useState("");

  const load = useCallback(async () => {
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (!me.ok) {
      setAllowed(false);
      return;
    }
    const meData = await me.json();
    if (meData.user?.role !== "ADMIN") {
      setAllowed(false);
      return;
    }
    setAllowed(true);

    const [s, u, d, w, p] = await Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }),
      fetch("/api/admin/users", { credentials: "include" }),
      fetch("/api/admin/deposits", { credentials: "include" }),
      fetch("/api/admin/withdrawals", { credentials: "include" }),
      fetch("/api/admin/promos", { credentials: "include" }),
    ]);

    if (s.ok) setStats(await s.json());
    if (u.ok) setUsers((await u.json()).users);
    if (d.ok) setDeposits((await d.json()).deposits);
    if (w.ok) setWithdrawals((await w.json()).withdrawals);
    if (p.ok) setPromos((await p.json()).promos);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function grantBalance(event: React.FormEvent) {
    event.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: grantUser,
        amount: Number(grantAmount),
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Выдано ${grantUser}: ${data.balance.toFixed(2)}` : data.error);
    if (res.ok) load();
  }

  async function createPromo(event: React.FormEvent) {
    event.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: promoCode,
        depositBonusPercent: Number(promoPercent),
        wagerMultiplier: Number(promoWager),
        maxUses: promoMax ? Number(promoMax) : null,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Промокод ${data.promo.code} создан` : data.error);
    if (res.ok) load();
  }

  async function processWithdrawal(
    id: string,
    action: "approve" | "paid" | "reject",
  ) {
    const adminNote =
      action === "reject"
        ? prompt("Причина отклонения (необязательно)") || ""
        : "";
    const res = await fetch("/api/admin/withdrawals", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, adminNote }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Заявка ${action}` : data.error);
    if (res.ok) load();
  }

  if (allowed === null) {
    return <main className="admin-page"><p>Загрузка...</p></main>;
  }

  if (!allowed) {
    return (
      <main className="admin-page">
        <h1>Доступ запрещён</h1>
        <p>Нужна роль ADMIN. Команда на сервере:</p>
        <code className="admin-code">node scripts/set-admin.mjs AlexKrit</code>
        <p>
          <Link href="/">На главную</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-head">
        <h1>Админ-панель</h1>
        <Link href="/" className="ghost-btn">
          На сайт
        </Link>
      </div>

      {msg && <p className="admin-msg">{msg}</p>}

      {stats && (
        <div className="admin-stats">
          <div className="admin-stat">
            <span>Пользователей</span>
            <strong>{stats.usersCount}</strong>
          </div>
          <div className="admin-stat">
            <span>Сумма балансов</span>
            <strong>{stats.totalBalance.toFixed(2)}</strong>
          </div>
          <div className="admin-stat">
            <span>Депозиты (всего)</span>
            <strong>{stats.depositsTotal.toFixed(2)}</strong>
          </div>
          <div className="admin-stat">
            <span>Выводы в ожидании</span>
            <strong>{stats.pendingWithdrawals}</strong>
          </div>
        </div>
      )}

      <section className="admin-section">
        <h2>Выдать баланс</h2>
        <form className="admin-form" onSubmit={grantBalance}>
          <input
            placeholder="Ник"
            value={grantUser}
            onChange={(e) => setGrantUser(e.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            value={grantAmount}
            onChange={(e) => setGrantAmount(e.target.value)}
            required
          />
          <button type="submit" className="primary-btn small">
            Выдать
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Создать промокод к депозиту</h2>
        <form className="admin-form" onSubmit={createPromo}>
          <input
            placeholder="КОД"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            required
          />
          <input
            type="number"
            min={1}
            placeholder="% к депозиту"
            value={promoPercent}
            onChange={(e) => setPromoPercent(e.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            step={0.5}
            placeholder="Вейджер ×"
            value={promoWager}
            onChange={(e) => setPromoWager(e.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            placeholder="Лимит (пусто = ∞)"
            value={promoMax}
            onChange={(e) => setPromoMax(e.target.value)}
          />
          <button type="submit" className="primary-btn small">
            Создать
          </button>
        </form>
        <ul className="admin-list compact">
          {promos.map((p) => (
            <li key={p.id}>
              {p.code} — +{p.depositBonusPercent}% к депозиту, вейджер ×
              {p.wagerMultiplier} ({p.usedCount}
              {p.maxUses != null ? ` / ${p.maxUses}` : ""})
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2>Пользователи</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ник</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Баланс</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Логи депозитов</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Ник</th>
                <th>Сумма</th>
                <th>Бонус</th>
                <th>Статус</th>
                <th>ID ЮMoney</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleString("ru-RU")}</td>
                  <td>{d.username}</td>
                  <td>{d.amount.toFixed(2)}</td>
                  <td>{d.bonusAmount > 0 ? d.bonusAmount.toFixed(2) : "—"}</td>
                  <td>{d.status}</td>
                  <td>{d.externalId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Заявки на вывод</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Ник</th>
                <th>Сумма</th>
                <th>Куда</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td>{new Date(w.createdAt).toLocaleString("ru-RU")}</td>
                  <td>{w.username}</td>
                  <td>{w.amount.toFixed(2)}</td>
                  <td>{w.payoutTo}</td>
                  <td>{w.status}</td>
                  <td className="admin-actions">
                    {w.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => processWithdrawal(w.id, "approve")}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => processWithdrawal(w.id, "paid")}
                        >
                          Выплачено
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => processWithdrawal(w.id, "reject")}
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
