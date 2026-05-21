"use client";

import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import type { ChatMessage } from "@/hooks/use-chat";

/** Basic markdown-like rendering: bold, italic, inline code, code blocks */
function renderContent(content: string) {
  // Split on code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code block
    if (part.startsWith("```") && part.endsWith("```")) {
      const inner = part.slice(3, -3);
      const newlineIdx = inner.indexOf("\n");
      const code = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner;
      return (
        <pre
          key={i}
          className="mt-2 mb-2 rounded-lg bg-black/30 p-3 text-xs overflow-x-auto font-mono"
        >
          <code>{code}</code>
        </pre>
      );
    }

    // Inline formatting
    return (
      <span key={i}>
        {part.split(/(`[^`]+`)/g).map((segment, j) => {
          if (segment.startsWith("`") && segment.endsWith("`")) {
            return (
              <code
                key={j}
                className="rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono text-primary"
              >
                {segment.slice(1, -1)}
              </code>
            );
          }

          // Bold
          let result: React.ReactNode = segment;
          const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
          if (boldParts.length > 1) {
            result = boldParts.map((bp, k) => {
              if (bp.startsWith("**") && bp.endsWith("**")) {
                return <strong key={k}>{bp.slice(2, -2)}</strong>;
              }
              return bp;
            });
          }

          return <span key={j}>{result}</span>;
        })}
      </span>
    );
  });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[85%]",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-emerald-500/15 text-emerald-400"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary/15 text-foreground"
            : "bg-card border border-border text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {renderContent(message.content)}
          {message.streaming && message.content.length > 0 && (
            <span className="animate-cursor ml-0.5 inline-block h-4 w-0.5 bg-primary align-text-bottom" />
          )}
        </div>
        {!message.streaming && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {relativeTime(message.created_at)}
          </p>
        )}
      </div>
    </div>
  );
}
