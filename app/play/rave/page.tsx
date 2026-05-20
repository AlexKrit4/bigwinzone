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

  const notifySlotLayout = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "RAVE_SLOT_LAYOUT" },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const t = window.setTimeout(() => notifySlotLayout(), 80);
    return () => window.clearTimeout(t);
  }, [immersive, notifySlotLayout]);

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
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    const syncFrame = () => {
      const viewportH =
        window.visualViewport?.height ??
        document.documentElement.clientHeight;
      const toolbar = shellRef.current?.querySelector<HTMLElement>(
        ".play-toolbar",
      );
      const toolbarH = toolbar?.offsetHeight ?? 0;
      if (mobile || immersive) {
        iframe.style.height = `${Math.max(200, Math.round(viewportH - toolbarH))}px`;
      } else {
        iframe.style.height = "";
      }
      notifySlotLayout();
    };
    syncFrame();
    const ro = shellRef.current ? new ResizeObserver(syncFrame) : null;
    if (shellRef.current) ro?.observe(shellRef.current);
    window.visualViewport?.addEventListener("resize", syncFrame);
    window.addEventListener("resize", syncFrame);
    return () => {
      ro?.disconnect();
      window.visualViewport?.removeEventListener("resize", syncFrame);
      window.removeEventListener("resize", syncFrame);
    };
  }, [mobile, immersive, notifySlotLayout]);

  return (
    <main className={`play-page${mobile ? " play-page--mobile" : ""}`}>
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
              <p className="eyebrow">Now Playing</p>
              <h1>Rave Slot</h1>
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
        <iframe
          ref={iframeRef}
          src="/slot/index.html?embed=1"
          className="slot-frame"
          title="Rave Slot"
          allow="autoplay; fullscreen"
          onLoad={notifySlotLayout}
        />
      </div>
    </main>
  );
}
