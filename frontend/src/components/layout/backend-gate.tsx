"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "";

function pokeBackend() {
  const script = document.createElement("script");
  script.src = `${BACKEND_URL}/health?t=${Date.now()}`;
  script.onerror = () => script.remove();
  script.onload = () => script.remove();
  document.head.appendChild(script);
}

export function BackendGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!BACKEND_URL || BACKEND_URL.includes("localhost")) {
      setReady(true);
      return;
    }

    let mounted = true;

    // Poke backend with a <script> tag — real browser request, no CORS, no ad blocker
    pokeBackend();
    const wakeInterval = setInterval(pokeBackend, 5000);

    // Poll proxy to detect when backend is ready
    const poll = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok && mounted) {
          setReady(true);
          clearInterval(wakeInterval);
          return;
        }
      } catch {}
      if (mounted) setTimeout(poll, 3000);
    };
    poll();

    return () => {
      mounted = false;
      clearInterval(wakeInterval);
    };
  }, []);

  if (ready) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--background)" }}
    >
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
      </div>
    </div>
  );
}
