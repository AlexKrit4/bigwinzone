"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthModal, AuthUser } from "@/components/AuthModal";

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  async function refreshMe() {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      setUser(null);
      return;
    }

    const data = await res.json();
    setUser(data.user);
  }

  useEffect(() => {
    refreshMe();

    const onBalance = (event: Event) => {
      const custom = event as CustomEvent<{ balance: number }>;
      setUser((current) =>
        current ? { ...current, balance: custom.detail.balance } : current,
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
                <strong>{user.balance.toFixed(2)}</strong>
              </div>
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
    </>
  );
}
