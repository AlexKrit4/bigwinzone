"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function XbootPlayContent() {
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [slotLoading, setSlotLoading] = useState(true);

  const isReplay = searchParams.get("replay") === "1";

  const iframeSrc = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("embed", "1");
    if (isReplay) {
      for (const key of [
        "replay",
        "seed",
        "index",
        "bet",
        "win",
        "mult",
        "scatter",
        "scatterBuy",
      ]) {
        const val = searchParams.get(key);
        if (val) qs.set(key, val);
      }
    }
    return `/slot/games/xboot/index.html?${qs.toString()}`;
  }, [isReplay, searchParams]);

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
      }
    } catch {
      setImmersive((v) => !v);
    }
  }, []);

  const notifySlotLayout = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "XBOOT_SLOT_LAYOUT" },
      window.location.origin,
    );
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
      if (event.data?.type === "XBOOT_SLOT_READY") {
        setSlotLoading(false);
      }
      if (event.data?.type === "XBOOT_PAUSE_AUDIO") {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "XBOOT_PAUSE_AUDIO" },
          window.location.origin,
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    setSlotLoading(true);
  }, [iframeSrc]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const syncFrame = () => {
      const viewportH =
        window.visualViewport?.height ??
        document.documentElement.clientHeight;
      const toolbar = shellRef.current?.querySelector<HTMLElement>(
        ".play-toolbar",
      );
      const toolbarH = toolbar?.offsetHeight ?? 0;
      if (mobile || immersive) {
        iframeRef.current!.style.height = `${Math.max(200, Math.round(viewportH - toolbarH))}px`;
      } else {
        iframeRef.current!.style.height = "";
      }
      notifySlotLayout();
    };
    syncFrame();
    window.addEventListener("resize", syncFrame);
    window.visualViewport?.addEventListener("resize", syncFrame);
    return () => {
      window.removeEventListener("resize", syncFrame);
      window.visualViewport?.removeEventListener("resize", syncFrame);
    };
  }, [mobile, immersive, notifySlotLayout]);

  return (
    <main className={`play-page play-page--xboot${mobile ? " play-page--mobile" : ""}`}>
      <div
        ref={shellRef}
        className={`play-shell${immersive ? " play-shell--immersive" : ""}`}
      >
        {!mobile && (
          <div className="play-toolbar">
            <Link href="/" className="play-back">
              ← Назад
            </Link>
            <div className="play-toolbar-meta">
              <p className="eyebrow">{isReplay ? "Повтор · BWZ" : "BigWinZone"}</p>
              <h1>Red Devil</h1>
            </div>
            <div className="play-toolbar-actions">
              <button
                type="button"
                onClick={() => void enterFullscreen()}
                className="secondary-btn play-fs-btn"
              >
                {immersive ? "Свернуть" : "На весь экран"}
              </button>
            </div>
          </div>
        )}
        <div className="play-frame-wrap">
          {slotLoading && (
            <div className="play-shell-loader" aria-live="polite">
              <div className="play-shell-loader-card">
                <p className="play-shell-loader-title">RED DEVIL</p>
                <p className="play-shell-loader-sub">
                  {isReplay ? "Загрузка повтора…" : "Загрузка слота…"}
                </p>
                <span className="play-shell-loader-spinner" aria-hidden="true" />
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="slot-frame"
            title="Red Devil Slot"
            allow="autoplay; fullscreen"
            onLoad={notifySlotLayout}
          />
        </div>
      </div>
    </main>
  );
}

export default function XbootPlayPage() {
  return (
    <Suspense
      fallback={
        <main className="play-page play-page--xboot">
          <div className="play-shell-loader" style={{ minHeight: "60vh" }}>
            <div className="play-shell-loader-card">
              <p className="play-shell-loader-title">RED DEVIL</p>
              <p className="play-shell-loader-sub">Загрузка…</p>
            </div>
          </div>
        </main>
      }
    >
      <XbootPlayContent />
    </Suspense>
  );
}
