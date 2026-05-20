"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export default function RavePlayPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(max-width: 900px), (hover: none) and (pointer: coarse)",
    );
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    document.body.classList.add("casino-play-active");
    return () => {
      mq.removeEventListener("change", sync);
      document.body.classList.remove("casino-play-active", "casino-play-immersive");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("casino-play-immersive", immersive);
    return () => document.body.classList.remove("casino-play-immersive");
  }, [immersive]);

  const enterFullscreen = useCallback(async () => {
    const target = shellRef.current ?? iframeRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setImmersive(false);
        return;
      }
      if (target.requestFullscreen) {
        await target.requestFullscreen();
        setImmersive(true);
        return;
      }
    } catch {
      /* iOS / embedded — CSS immersive */
    }
    setImmersive((v) => !v);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "CASINO_BALANCE_UPDATED") {
        window.dispatchEvent(
          new CustomEvent("casino:balance", {
            detail: { balance: event.data.balance },
          }),
        );
      }

      if (event.data?.type === "RAVE_SLOT_REQUEST_FULLSCREEN") {
        void enterFullscreen();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enterFullscreen]);

  useEffect(() => {
    const onFsChange = () => {
      setImmersive(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!mobile || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const postHeight = () => {
      const h =
        window.visualViewport?.height ??
        document.documentElement.clientHeight;
      iframe.style.height = `${Math.round(h)}px`;
    };
    postHeight();
    window.visualViewport?.addEventListener("resize", postHeight);
    window.addEventListener("resize", postHeight);
    return () => {
      window.visualViewport?.removeEventListener("resize", postHeight);
      window.removeEventListener("resize", postHeight);
    };
  }, [mobile]);

  return (
    <main className={`play-page${mobile ? " play-page--mobile" : ""}`}>
      <div
        ref={shellRef}
        className={`play-shell${immersive ? " play-shell--immersive" : ""}`}
      >
        <div className="play-toolbar">
          <Link href="/" className="play-back">
            ← Назад
          </Link>
          {!mobile && (
            <div className="play-toolbar-meta">
              <p className="eyebrow">Now Playing</p>
              <h1>Rave Slot</h1>
            </div>
          )}
          <div className="play-toolbar-actions">
            {mobile && (
              <span className="play-toolbar-hint">Баланс синхронизируется с аккаунтом</span>
            )}
            <button
              type="button"
              onClick={() => void enterFullscreen()}
              className="secondary-btn play-fs-btn"
            >
              {immersive ? "Свернуть" : "На весь экран"}
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          src="/slot/index.html?embed=1"
          className="slot-frame"
          title="Rave Slot"
          allow="autoplay; fullscreen"
        />
      </div>
    </main>
  );
}
