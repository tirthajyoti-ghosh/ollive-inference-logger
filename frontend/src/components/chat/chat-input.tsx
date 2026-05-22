"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  providerLabel?: string;
  modelName?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  isStreaming,
  disabled,
  providerLabel,
  modelName,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const placeholder = isStreaming
    ? "Waiting for response…"
    : modelName
      ? `Reply to ${modelName}…`
      : "Type a message…";

  return (
    <div
      className="px-6 py-4"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="max-w-[820px] mx-auto">
        <div
          className="rounded-[14px] p-3"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            background: "var(--surface)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isStreaming || disabled}
            rows={2}
            className="w-full resize-none text-[14px] leading-relaxed focus:outline-none disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "none",
            }}
          />

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-1">
            {/* Provider badge (left) */}
            <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
              {providerLabel && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border text-[11.5px] px-2 py-0.5"
                  style={{ background: "oklch(0.96 0.02 130)", borderColor: "oklch(0.88 0.02 80)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--olive)" }} />
                  <span className="font-medium" style={{ color: "var(--ink)" }}>{providerLabel}</span>
                </span>
              )}
            </div>

            {/* Send hint + button (right) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono hidden sm:flex items-center gap-0.5" style={{ color: "var(--faint)" }}>
                <kbd
                  className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded text-[10.5px] font-mono"
                  style={{ border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink-2)" }}
                >
                  ⌘
                </kbd>
                <kbd
                  className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded text-[10.5px] font-mono"
                  style={{ border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink-2)" }}
                >
                  ↵
                </kbd>
                <span className="ml-1">to send</span>
              </span>

              {isStreaming ? (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={onCancel}
                >
                  <Square size={13} />
                  Cancel
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSend}
                  disabled={!value.trim() || disabled}
                  style={{
                    opacity: !value.trim() || disabled ? 0.5 : 1,
                    cursor: !value.trim() || disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <Send size={13} />
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
