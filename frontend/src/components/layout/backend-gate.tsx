"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function BackendGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wakeRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const reloadIframe = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = `${BACKEND_URL}/health?t=${Date.now()}`;
    }
  }, []);

  useEffect(() => {
    if (!BACKEND_URL || BACKEND_URL.includes("localhost")) {
      setReady(true);
      return;
    }

    let mounted = true;

    // Reload iframe every 5s to keep poking the backend
    wakeRef.current = setInterval(reloadIframe, 5000);

    // Show manual fallback link after 15s
    const fallbackTimer = setTimeout(() => {
      if (mounted) setShowManual(true);
    }, 15000);

    // Poll proxy endpoint to detect when backend is ready
    const poll = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok && mounted) {
          setReady(true);
          clearInterval(wakeRef.current);
          return;
        }
      } catch {}
      if (mounted) setTimeout(poll, 3000);
    };
    poll();

    return () => {
      mounted = false;
      clearInterval(wakeRef.current);
      clearTimeout(fallbackTimer);
    };
  }, [reloadIframe]);

  if (ready) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      {/* Hidden iframe — real browser navigation that wakes Render */}
      <iframe
        ref={iframeRef}
        src={`${BACKEND_URL}/health`}
        style={{ position: "absolute", width: 0, height: 0, border: "none", opacity: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div
          className="w-12 h-12 rounded-2xl grid place-items-center"
          style={{
            background: "var(--olive)",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.18), 0 2px 8px oklch(0.4 0.05 130 / 0.25)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 16c0-5 4-10 9-12-1 5-3 10-7 12-1 0-2 0-2 0z" fill="#fff" fillOpacity="0.95"/>
            <path d="M14 4c5 2 7 7 5 14-4-2-7-7-5-14z" fill="#fff" fillOpacity="0.75"/>
          </svg>
        </div>
        <div>
          <h1
            className="text-[18px] font-semibold mb-1"
            style={{ color: "var(--ink)" }}
          >
            Waking up...
          </h1>
          <p
            className="text-[13px] leading-relaxed max-w-[320px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            The backend is on a free tier and hibernates after inactivity.
            It takes about 30 seconds to start. Hang tight.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "oklch(0.7 0.12 75)" }}
          />
          <span
            className="text-[12px] font-mono"
            style={{ color: "var(--muted-foreground)" }}
          >
            connecting to backend...
          </span>
        </div>
        {showManual && (
          <a
            href={`${BACKEND_URL}/health`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 text-[12.5px] font-medium underline underline-offset-2"
            style={{ color: "var(--olive-fg)" }}
          >
            Taking too long? Click here to wake the backend manually
          </a>
        )}
      </div>
    </div>
  );
}
