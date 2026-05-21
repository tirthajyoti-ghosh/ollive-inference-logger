"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (content: string) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onCancel,
  isStreaming,
  disabled,
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
    <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for newline)"
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
            {value.length > 0 ? value.length : ""}
          </span>
        </div>

        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 rounded-xl shrink-0"
            onClick={onCancel}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl shrink-0"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
