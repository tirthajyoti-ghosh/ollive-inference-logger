"use client";

import { cn, relativeTime } from "@/lib/utils";
import { User, Sparkles, Copy, Check, Clock, ArrowDown, ArrowUp } from "lucide-react";
import { useState, useCallback } from "react";
import type { ChatMessage } from "@/hooks/use-chat";

function renderMarkdown(text: string) {
  const blocks = text.split(/(```[\s\S]*?```)/g);

  return blocks.map((block, i) => {
    if (block.startsWith("```") && block.endsWith("```")) {
      const inner = block.slice(3, -3);
      const nl = inner.indexOf("\n");
      const lang = nl >= 0 ? inner.slice(0, nl).trim() : "";
      const code = nl >= 0 ? inner.slice(nl + 1) : inner;
      return (
        <div
          key={i}
          className="my-3 rounded-[10px] overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "oklch(0.985 0.005 80)" }}
        >
          <div
            className="px-3 py-1.5 flex items-center justify-between text-[11px] font-mono"
            style={{ background: "var(--bg-2)", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}
          >
            <span>{lang || "code"}</span>
            <CopyButton text={code} />
          </div>
          <pre
            className="px-4 py-3 text-[12.5px] font-mono leading-relaxed overflow-x-auto"
            style={{ color: "oklch(0.32 0.02 80)" }}
          >
            {code.replace(/\n$/, "")}
          </pre>
        </div>
      );
    }

    return block.split(/\n\n/).map((para, j) => {
      const parts = para.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
      return (
        <p key={`${i}-${j}`} className="text-[14px] leading-[1.65] mb-3 last:mb-0" style={{ color: "var(--ink)" }}>
          {parts.map((p, k) => {
            if (p.startsWith("`") && p.endsWith("`")) {
              return (
                <code
                  key={k}
                  className="font-mono text-[12.5px] px-1 py-0.5 rounded"
                  style={{ background: "var(--bg-2)", color: "var(--olive-fg)", border: "1px solid var(--border)" }}
                >
                  {p.slice(1, -1)}
                </code>
              );
            }
            if (p.startsWith("**") && p.endsWith("**")) {
              return <strong key={k} className="font-semibold" style={{ color: "var(--ink)" }}>{p.slice(2, -2)}</strong>;
            }
            const lines = p.split(/\n/);
            return (
              <span key={k}>
                {lines.map((ln, m) => (
                  <span key={m}>{ln}{m < lines.length - 1 && <br />}</span>
                ))}
              </span>
            );
          })}
        </p>
      );
    });
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
      className="flex items-center gap-1 hover:opacity-70 transition-opacity"
      style={{ color: "var(--muted-foreground)" }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span className="text-[10.5px]">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

export function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {/* Assistant avatar (left) */}
      {!isUser && (
        <div
          className="w-7 h-7 shrink-0 rounded-[8px] grid place-items-center mt-0.5"
          style={{ background: "var(--olive-soft)", color: "var(--olive-fg)" }}
        >
          <Sparkles size={14} />
        </div>
      )}

      <div className="max-w-[680px]">
        {isUser ? (
          <div
            className="inline-block"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px 14px 4px 14px",
              padding: "10px 14px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="text-[14px] leading-[1.6] whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
              {message.content}
            </div>
          </div>
        ) : (
          <div>
            {renderMarkdown(message.content)}
            {isStreaming && <span className="caret" />}
          </div>
        )}

        {/* Meta line under finalized assistant messages */}
        {!isUser && !isStreaming && !message.streaming && message.content && (
          <div className="flex items-center gap-3 mt-2 text-[11px] font-mono" style={{ color: "var(--faint)" }}>
            <span>{relativeTime(message.created_at)}</span>
            <CopyButton text={message.content} />
          </div>
        )}
      </div>

      {/* User avatar (right) */}
      {isUser && (
        <div
          className="w-7 h-7 shrink-0 rounded-[8px] grid place-items-center mt-0.5"
          style={{ background: "oklch(0.93 0.03 235)", color: "oklch(0.4 0.1 235)" }}
        >
          <User size={14} />
        </div>
      )}
    </div>
  );
}
