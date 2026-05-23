"use client";

import { cn, relativeTime, formatLatency, formatCurrency } from "@/lib/utils";
import { User, Sparkles, Copy, Check, Clock, ArrowDown, ArrowUp, ChevronDown, Brain } from "lucide-react";
import { useState, useCallback } from "react";
import type { ChatMessage } from "@/hooks/use-chat";

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, k) => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={`${keyPrefix}-${k}`}
          className="font-mono text-[12.5px] px-1 py-0.5 rounded"
          style={{ background: "var(--bg-2)", color: "var(--olive-fg)", border: "1px solid var(--border)" }}
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={`${keyPrefix}-${k}`} className="font-semibold" style={{ color: "var(--ink)" }}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*") && !p.startsWith("**")) {
      return <em key={`${keyPrefix}-${k}`}>{p.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-${k}`}>{p}</span>;
  });
}

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
          <pre className="px-4 py-3 text-[12.5px] font-mono leading-relaxed overflow-x-auto" style={{ color: "oklch(0.32 0.02 80)" }}>{code.replace(/\n$/, "")}</pre>
        </div>
      );
    }

    const lines = block.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;

    const flushList = () => {
      if (!listBuffer) return;
      const Tag = listBuffer.type === "ul" ? "ul" : "ol";
      const cls = listBuffer.type === "ul"
        ? "list-disc pl-5 mb-3 space-y-1 text-[14px] leading-[1.65]"
        : "list-decimal pl-5 mb-3 space-y-1 text-[14px] leading-[1.65]";
      elements.push(
        <Tag key={`${i}-list-${elements.length}`} className={cls} style={{ color: "var(--ink)" }}>
          {listBuffer.items.map((item, li) => (
            <li key={li}>{renderInline(item, `${i}-li-${li}`)}</li>
          ))}
        </Tag>
      );
      listBuffer = null;
    };

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];

      if (/^---+$/.test(line.trim())) {
        flushList();
        elements.push(<hr key={`${i}-${j}`} className="my-4" style={{ borderColor: "var(--border)" }} />);
        continue;
      }

      const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const sizes: Record<number, string> = { 1: "text-[18px]", 2: "text-[16px]", 3: "text-[15px]", 4: "text-[14px]" };
        elements.push(
          <div key={`${i}-${j}`} className={`${sizes[level] || "text-[14px]"} font-semibold mt-4 mb-2`} style={{ color: "var(--ink)" }}>
            {renderInline(headingText, `${i}-h-${j}`)}
          </div>
        );
        continue;
      }

      const bulletMatch = line.match(/^[\s]*[*\-]\s+(.+)/);
      if (bulletMatch) {
        if (!listBuffer || listBuffer.type !== "ul") {
          flushList();
          listBuffer = { type: "ul", items: [] };
        }
        listBuffer.items.push(bulletMatch[1]);
        continue;
      }

      const numMatch = line.match(/^[\s]*\d+\.\s+(.+)/);
      if (numMatch) {
        if (!listBuffer || listBuffer.type !== "ol") {
          flushList();
          listBuffer = { type: "ol", items: [] };
        }
        listBuffer.items.push(numMatch[1]);
        continue;
      }

      // Table: detect rows starting with |
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        flushList();
        const tableRows: string[][] = [];
        let tj = j;
        while (tj < lines.length && lines[tj].trim().startsWith("|") && lines[tj].trim().endsWith("|")) {
          const cells = lines[tj].trim().slice(1, -1).split("|").map((c) => c.trim());
          tableRows.push(cells);
          tj++;
        }
        j = tj - 1;
        const hasHeader = tableRows.length >= 2 && tableRows[1].every((c) => /^[-:]+$/.test(c));
        const header = hasHeader ? tableRows[0] : null;
        const body = hasHeader ? tableRows.slice(2) : tableRows;
        elements.push(
          <div key={`${i}-tbl-${j}`} className="my-3 overflow-x-auto rounded-[8px]" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              {header && (
                <thead>
                  <tr style={{ background: "var(--bg-2)" }}>
                    {header.map((h, hi) => (
                      <th key={hi} className="px-3 py-2 text-left font-semibold" style={{ color: "var(--ink)", borderBottom: "1px solid var(--border)" }}>
                        {renderInline(h, `${i}-th-${hi}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: ri < body.length - 1 ? "1px solid var(--border)" : undefined }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2" style={{ color: "var(--ink)" }}>
                        {renderInline(cell, `${i}-td-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      if (line.trim() === "") {
        flushList();
        continue;
      }

      flushList();
      elements.push(
        <p key={`${i}-${j}`} className="text-[14px] leading-[1.65] mb-3 last:mb-0" style={{ color: "var(--ink)" }}>
          {renderInline(line, `${i}-p-${j}`)}
        </p>
      );
    }

    flushList();
    return <span key={i}>{elements}</span>;
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
      className="flex items-center gap-1 hover:text-[var(--ink-2)] transition-colors"
      style={{ color: "var(--muted-foreground)" }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span className="text-[10.5px]">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(isStreaming ?? false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors"
        style={{
          background: "var(--olive-soft)",
          color: "var(--olive-fg)",
          border: "1px solid oklch(0.85 0.05 130)",
        }}
      >
        <Brain size={12} />
        {isStreaming ? "Thinking..." : "Thought process"}
        <ChevronDown
          size={12}
          className="transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>
      {(expanded || isStreaming) && (
        <div
          className="mt-2 px-3 py-2.5 rounded-[10px] text-[12.5px] leading-relaxed font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          {text}
          {isStreaming && <span className="caret" />}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {/* Assistant avatar — left */}
      {!isUser && (
        <div
          className="w-7 h-7 shrink-0 rounded-[8px] grid place-items-center mt-0.5"
          style={{ background: "var(--olive-soft)", color: "var(--olive-fg)" }}
        >
          <Sparkles size={14} />
        </div>
      )}

      <div className={`max-w-[680px] ${isUser ? "order-1" : ""}`}>
        {isUser ? (
          /* User bubble — right-aligned, asymmetric radius */
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
          /* Assistant — no bubble, just rendered content */
          <div>
            {message.thinking && (
              <ThinkingBlock
                text={message.thinking}
                isStreaming={isStreaming && !message.content}
              />
            )}
            {renderMarkdown(message.content)}
            {isStreaming && <span className="caret" />}
          </div>
        )}

        {/* Meta line — matches prototype: clock+latency · ↓in · ↑out · cost · copy */}
        {!isUser && !isStreaming && !message.streaming && message.content && (
          <div className="flex items-center gap-3 mt-2 text-[11px] font-mono" style={{ color: "var(--faint)" }}>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {message.latency_ms ? formatLatency(message.latency_ms) : relativeTime(message.created_at)}
            </span>
            {message.tokens_in != null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <ArrowDown size={10} />
                  {message.tokens_in} in
                </span>
                <span className="flex items-center gap-0.5">
                  <ArrowUp size={10} />
                  {message.tokens_out ?? 0} out
                </span>
              </>
            )}
            {message.cost != null && (
              <>
                <span>·</span>
                <span>{formatCurrency(message.cost)}</span>
              </>
            )}
            <CopyButton text={message.content} />
          </div>
        )}
      </div>

      {/* User avatar — right */}
      {isUser && (
        <div
          className="w-7 h-7 shrink-0 rounded-[8px] grid place-items-center mt-0.5 order-2"
          style={{ background: "oklch(0.93 0.03 235)", color: "oklch(0.4 0.1 235)" }}
        >
          <User size={14} />
        </div>
      )}
    </div>
  );
}
