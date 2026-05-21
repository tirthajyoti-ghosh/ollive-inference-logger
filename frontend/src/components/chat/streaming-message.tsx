"use client";

import { Bot } from "lucide-react";

export function StreamingPlaceholder() {
  return (
    <div className="flex gap-3 mr-auto max-w-[85%]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.10] text-emerald-400 border border-emerald-500/[0.08]">
        <Bot className="h-4 w-4" />
      </div>
      <div className="glass-card rounded-2xl px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="ml-2 text-xs text-muted-foreground/60">Thinking...</span>
        </div>
      </div>
    </div>
  );
}
