"use client";

import { Sparkles } from "lucide-react";

export function StreamingPlaceholder() {
  return (
    <div className="flex gap-3 mr-auto max-w-[85%]">
      {/* Olive-soft sparkle avatar */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--olive-soft)", color: "var(--olive-fg)" }}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      {/* Thinking pill */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-2)" }}>
          Thinking
        </span>
        <span className="flex items-center gap-1">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </div>
    </div>
  );
}
