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
  cash: number;
  bonus: number;
  promoDeposit: number;
  createdAt: string;
};

type DepositRow = {
  id: string;
  username: string;
  amount: number;
  bonusAmount: number;
  status: string;
  label: string;
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
  const [grantWager, setGrantWager] = useState("3");
  const [revokeUser, setRevokeUser] = useState("");
  const [revokeAmount, setRevokeAmount] = useState("100");
  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState("100");
  const [promoWager, setPromoWager] = useState("3");
  const [promoMax, setPromoMax] = useState("");

  async function confirmDeposit(depositId: string) {
    if (!confirm("Зачислить депозит на баланс? Убедитесь, что деньги уже пришли в кошелёк ЮMoney.")) {
      return;
    }
    setMsg("");
    const res = await fetch("/api/admin/deposits", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Ошибка подтверждения");
      return;
    }
    setMsg("Депозит зачислен");
    load();
  }

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
        action: "grant",
        username: grantUser,
        amount: Number(grantAmount),
        wagerMultiplier: Number(grantWager),
      }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? `Выдано ${grantUser}: ${data.balance.toFixed(2)} ₽, код ${data.code}, отыгрыш ${data.wagerRequired} ₽`
        : data.error,
    );
    if (res.ok) load();
  }

  async function revokeBalance(event: React.FormEvent) {
    event.preventDefault();
    if (
      !confirm(
        `Списать ${revokeAmount} ₽ у ${revokeUser}? Активный ADM-бонус будет отменён, выданные бонусные рубли — списаны.`,
      )
    ) {
      return;
    }
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "revoke",
        username: revokeUser,
        amount: Number(revokeAmount),
      }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? `Списано ${data.revoked.toFixed(2)} ₽, баланс ${revokeUser}: ${data.balance.toFixed(2)}`
        : data.error,
    );
    if (res.ok) load();
  }

  async function quickRevoke(username: string, cash: number) {
    const raw = prompt(
      `Списать реальные деньги у ${username}? (сейчас ${cash.toFixed(2)} ₽, бонус/промо не трогаем)`,
      String(Math.min(100, cash)),
    );
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", username, amount }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Списано ${data.revoked.toFixed(2)} ₽` : data.error);
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
        <h2>Выдать баланс (с отыгрышем)</h2>
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
            placeholder="Сумма ₽"
            value={grantAmount}
            onChange={(e) => setGrantAmount(e.target.value)}
            required
          />
          <input
            type="number"
            min={0}
            step={0.5}
            placeholder="Вейджер ×"
            value={grantWager}
            onChange={(e) => setGrantWager(e.target.value)}
            required
          />
          <button type="submit" className="primary-btn small">
            Выдать
          </button>
        </form>
        <p className="wallet-hint">
          Сумма на бонусный счёт, код ADM-… в профиле. Отыгрыш = сумма × вейджер.
          Отмена промо обнуляет бонус.
        </p>
      </section>

      <section className="admin-section">
        <h2>Списать с баланса</h2>
        <form className="admin-form" onSubmit={revokeBalance}>
          <input
            placeholder="Ник"
            value={revokeUser}
            onChange={(e) => setRevokeUser(e.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            placeholder="Сумма ₽"
            value={revokeAmount}
            onChange={(e) => setRevokeAmount(e.target.value)}
            required
          />
          <button type="submit" className="ghost-btn">
            Списать
          </button>
        </form>
        <p className="wallet-hint">
          Списание только с реальных денег. Бонусный счёт и депозит под промо не затрагиваются.
        </p>
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
                <th>Всего</th>
                <th>Реал.</th>
                <th>Бонус</th>
                <th>Промо</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.balance.toFixed(2)}</td>
                  <td>{u.cash.toFixed(2)}</td>
                  <td>{u.bonus.toFixed(2)}</td>
                  <td>{u.promoDeposit.toFixed(2)}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void quickRevoke(u.username, u.cash)}
                    >
                      Забрать
                    </button>
                  </td>
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
                <th>Метка</th>
                <th>ID ЮMoney</th>
                <th></th>
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
                  <td style={{ fontSize: "0.8rem" }}>{d.label}</td>
                  <td>{d.externalId || "—"}</td>
                  <td className="admin-actions">
                    {d.status === "PENDING" && (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => confirmDeposit(d.id)}
                      >
                        Зачислить
                      </button>
                    )}
                  </td>
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
