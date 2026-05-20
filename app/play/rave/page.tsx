"use client";

import { useEffect, useRef } from "react";

export default function RavePlayPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      }
    }
  };

  return (
    <main className="play-page">
      <div className="play-shell">
        <div className="play-heading">
          <div>
            <p className="eyebrow">Now Playing</p>
            <h1>Rave Slot</h1>
          </div>
          <div className="play-heading-actions">
            <p>
              Баланс внутри слота синхронизируется с аккаунтом.
            </p>
            <button onClick={handleFullscreen} className="secondary-btn">
              На весь экран
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          src="/slot/index.html"
          className="slot-frame"
          title="Rave Slot"
          allow="autoplay; fullscreen"
        />
      </div>
    </main>
  );
}
