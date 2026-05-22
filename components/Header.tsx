"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthModal, AuthUser } from "@/components/AuthModal";
import { BalanceBreakdown, type BalanceParts } from "@/components/BalanceBreakdown";
import { ProfileModal } from "@/components/ProfileModal";
import { WalletModal } from "@/components/WalletModal";

function toBalanceParts(user: AuthUser): BalanceParts {
  return {
    balance: user.balance,
    cash: user.cash ?? user.balance,
    bonus: user.bonus ?? 0,
    promoDeposit: user.promoDeposit ?? 0,
  };
}

function applyBalanceUpdate(user: AuthUser, data: Partial<BalanceParts>): AuthUser {
  const cash = data.cash ?? user.cash ?? 0;
  const bonus = data.bonus ?? user.bonus ?? 0;
  const promoDeposit = data.promoDeposit ?? user.promoDeposit ?? 0;
  const balance = data.balance ?? cash + bonus + promoDeposit;
  return { ...user, cash, bonus, promoDeposit, balance };
}

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<"deposit" | "withdraw" | "promo">(
    "deposit",
  );
  const [profileOpen, setProfileOpen] = useState(false);

  async function refreshMe() {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      setUser(null);
      return;
    }

    const data = await res.json();
    setUser(data.user);
  }

  function emitBalance(parts: BalanceParts) {
    window.dispatchEvent(
      new CustomEvent("casino:balance", { detail: parts }),
    );
  }

  function onBalancesUpdate(data: Partial<BalanceParts>) {
    setUser((u) => {
      if (!u) return u;
      const next = applyBalanceUpdate(u, data);
      emitBalance(toBalanceParts(next));
      return next;
    });
  }

  useEffect(() => {
    refreshMe();

    const params = new URLSearchParams(window.location.search);
    if (params.get("deposit") !== "success") return;

    const label = sessionStorage.getItem("pendingDepositLabel");
    if (!label) return;

    let stopped = false;
    let attempts = 0;
    const maxAttempts = 40;

    const poll = async () => {
      if (stopped || attempts >= maxAttempts) return;
      attempts += 1;

      const res = await fetch(
        `/api/wallet/deposit/status?label=${encodeURIComponent(label)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;

      const data = await res.json();
      if (data.status === "COMPLETED") {
        stopped = true;
        sessionStorage.removeItem("pendingDepositLabel");
        await refreshMe();
        const url = new URL(window.location.href);
        url.searchParams.delete("deposit");
        window.history.replaceState({}, "", url.pathname + url.search);
        return;
      }

      window.setTimeout(poll, 3000);
    };

    poll();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    refreshMe();

    const onBalance = (event: Event) => {
      const custom = event as CustomEvent<BalanceParts>;
      if (!custom.detail) return;
      setUser((current) =>
        current ? applyBalanceUpdate(current, custom.detail) : current,
      );
    };

    window.addEventListener("casino:balance", onBalance);
    return () => window.removeEventListener("casino:balance", onBalance);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          <span>Rave Casino</span>
        </Link>
        <nav className="site-nav">
          <Link href="/play/rave">Rave Slot</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <div className="user-pill">
                <span>{user.username}</span>
                <BalanceBreakdown
                  parts={toBalanceParts(user)}
                  onRefresh={() => void refreshMe()}
                />
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setProfileOpen(true)}
              >
                Профиль
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setWalletTab("deposit");
                  setWalletOpen(true);
                }}
              >
                Депозит
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setWalletTab("withdraw");
                  setWalletOpen(true);
                }}
              >
                Вывод
              </button>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="ghost-btn">
                  Админ
                </Link>
              )}
              <button className="ghost-btn" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <button className="ghost-btn" onClick={() => setAuthMode("login")}>
                Вход
              </button>
              <button className="primary-btn small" onClick={() => setAuthMode("register")}>
                Регистрация
              </button>
            </>
          )}
        </div>
      </header>
      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onAuthed={setUser}
        />
      )}
      {profileOpen && user && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onBalancesUpdate={onBalancesUpdate}
        />
      )}
      {walletOpen && user && (
        <WalletModal
          user={user}
          initialTab={walletTab}
          onClose={() => setWalletOpen(false)}
          onBalancesUpdate={onBalancesUpdate}
        />
      )}
    </>
  );
}
