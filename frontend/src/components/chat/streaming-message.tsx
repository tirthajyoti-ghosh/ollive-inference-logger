"use client";

import { Bot } from "lucide-react";

export function StreamingPlaceholder() {
  return (
    <div className="flex gap-3 mr-auto max-w-[85%]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl bg-card border border-border px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
          <span
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
            style={{ animationDelay: "0.2s" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
          <span className="ml-2 text-xs">Thinking...</span>
        </div>
      </div>
    </div>
  );
}
