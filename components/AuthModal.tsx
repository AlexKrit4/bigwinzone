"use client";

import { FormEvent, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  balance: number;
  cash?: number;
  bonus?: number;
  promoDeposit?: number;
  role?: string;
};

type AuthModalProps = {
  mode: "login" | "register";
  onClose: () => void;
  onAuthed: (user: AuthUser) => void;
};

export function AuthModal({ mode, onClose, onAuthed }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: isRegister ? username : undefined,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка авторизации");
      }

      onAuthed(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true">
      <div className="auth-modal">
        <button className="modal-x" onClick={onClose} aria-label="Закрыть">
          x
        </button>
        <p className="eyebrow">{isRegister ? "Create account" : "Welcome back"}</p>
        <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {isRegister && (
            <label>
              Ник
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={2}
                required
              />
            </label>
          )}
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary-btn" disabled={loading}>
            {loading ? "Подождите..." : isRegister ? "Создать аккаунт" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
