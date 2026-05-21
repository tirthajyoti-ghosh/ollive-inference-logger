"use client";

import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { User, Sparkles, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
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
      const lang = newlineIdx >= 0 ? inner.slice(0, newlineIdx).trim() : "";
      const code = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner;
      return (
        <pre
          key={i}
          className="mt-2.5 mb-2.5 rounded-[10px] overflow-hidden text-xs font-mono"
          style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[11px]"
            style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            <span>{lang || "code"}</span>
            <CopyButton text={code} />
          </div>
          <code className="block px-3 py-2.5 overflow-x-auto" style={{ color: "var(--ink)" }}>
            {code}
          </code>
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
                className="rounded-md px-1.5 py-0.5 text-xs font-mono"
                style={{ background: "var(--olive-soft)", color: "var(--olive-fg)" }}
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="btn-ghost btn-sm inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px]"
      style={{ color: "var(--muted-foreground)" }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
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
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        )}
        style={
          isUser
            ? { background: "oklch(0.55 0.08 235)", color: "#fff" }
            : { background: "var(--olive-soft)", color: "var(--olive-fg)" }
        }
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0">
        {isUser ? (
          /* User bubble */
          <div
            className="px-4 py-3 text-sm leading-relaxed"
            style={{
              borderRadius: "14px 14px 4px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
              color: "var(--ink)",
            }}
          >
            <div className="whitespace-pre-wrap break-words">
              {renderContent(message.content)}
            </div>
          </div>
        ) : (
          /* Assistant: no bubble, just rendered markdown */
          <div className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
            <div className="whitespace-pre-wrap break-words">
              {renderContent(message.content)}
              {message.streaming && message.content.length > 0 && (
                <span className="caret" />
              )}
            </div>
          </div>
        )}

        {/* Meta line under messages */}
        {!message.streaming && (
          <div
            className={cn(
              "mt-1.5 flex items-center gap-3 font-mono text-[11px]",
              isUser ? "justify-end" : "justify-start"
            )}
            style={{ color: "var(--faint)" }}
          >
            <span>{relativeTime(message.created_at)}</span>
            {!isUser && (
              <>
                <CopyButton text={message.content} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
