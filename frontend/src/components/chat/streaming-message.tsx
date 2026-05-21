"use client";

import { Sparkles } from "lucide-react";

export function StreamingPlaceholder() {
  return (
    <div className="flex gap-3 justify-start">
      {/* Avatar — matches assistant avatar exactly */}
      <div
        className="w-7 h-7 shrink-0 rounded-[8px] grid place-items-center mt-0.5"
        style={{ background: "var(--olive-soft)", color: "var(--olive-fg)" }}
      >
        <Sparkles size={14} />
      </div>

      {/* Thinking pill */}
      <div
        className="inline-flex items-center gap-2 px-3 py-2 rounded-[12px]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <span className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
          Thinking
        </span>
        <span className="flex items-center gap-1 px-1">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </div>
    </div>
  );
}
