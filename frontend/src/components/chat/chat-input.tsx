"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  providerLabel?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  isStreaming,
  disabled,
  providerLabel,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
          className="rounded-[14px] overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            background: "var(--surface)",
          }}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={2}
            className="w-full resize-none px-4 pt-3 pb-1 text-sm focus:outline-none disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "none",
            }}
          />

          {/* Bottom row */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            {/* Provider badge (left) */}
            <div>
              {providerLabel && (
                <span className="badge badge-olive text-[10.5px]">
                  {providerLabel}
                </span>
              )}
            </div>

            {/* Send hint + button (right) */}
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-mono hidden sm:inline"
                style={{ color: "var(--faint)" }}
              >
                Enter to send
              </span>

              {isStreaming ? (
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={onCancel}
                  title="Stop"
                >
                  <Square size={14} />
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
                  <Send size={14} />
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
