"use client";

import { useEffect, useRef, useState } from "react";

export type BalanceParts = {
  balance: number;
  cash: number;
  bonus: number;
  promoDeposit: number;
};

type BalanceBreakdownProps = {
  parts: BalanceParts;
  onRefresh?: () => void;
};

export function BalanceBreakdown({ parts, onRefresh }: BalanceBreakdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="balance-breakdown" ref={wrapRef}>
      <button
        type="button"
        className="balance-breakdown-trigger"
        onClick={() => {
          setOpen((v) => !v);
          onRefresh?.();
        }}
        aria-expanded={open}
        title="Ваш счёт"
      >
        <strong>{parts.balance.toFixed(2)} ₽</strong>
        <span className="balance-breakdown-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="balance-breakdown-menu">
          <li>
            <span>Основной счёт</span>
            <strong>{parts.cash.toFixed(2)} ₽</strong>
          </li>
          <li>
            <span>Бонусные средства</span>
            <strong>{parts.bonus.toFixed(2)} ₽</strong>
          </li>
          <li>
            <span>Бонус к депозиту</span>
            <strong>{parts.promoDeposit.toFixed(2)} ₽</strong>
          </li>
        </ul>
      )}
    </div>
  );
}
