"use client";

import { useCallback, useRef, useState } from "react";

export interface StreamStats {
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
}

interface StreamCallbacks {
  onThinking: (token: string) => void;
  onToken: (token: string) => void;
  onDone: (messageId: string, stats?: StreamStats) => void;
  onError: (error: string) => void;
}

const TYPEWRITER_CHUNK = 4;
const TYPEWRITER_MS = 12;

export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startStream = useCallback(
    async (
      conversationId: string,
      content: string,
      provider: string,
      model: string,
      { onThinking, onToken, onDone, onError }: StreamCallbacks
    ) => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      let pendingDone: string | null = null;
      let pendingStats: StreamStats | undefined;

      const typewrite = (text: string, resolve: () => void) => {
        let pos = 0;
        const tick = () => {
          if (controller.signal.aborted) { resolve(); return; }
          const end = Math.min(pos + TYPEWRITER_CHUNK, text.length);
          onToken(text.slice(pos, end));
          pos = end;
          if (pos < text.length) {
            typewriterRef.current = setTimeout(tick, TYPEWRITER_MS);
          } else {
            resolve();
          }
        };
        tick();
      };

      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/chat/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, provider, model }),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Stream failed (${res.status}): ${text || res.statusText}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const json = trimmed.slice(6);
            try {
              const data = JSON.parse(json);
              if (data.thinking) {
                onThinking(data.thinking);
              } else if (data.token) {
                if (data.token.length > 80) {
                  await new Promise<void>((resolve) => typewrite(data.token, resolve));
                } else {
                  onToken(data.token);
                  await new Promise((r) => requestAnimationFrame(r));
                }
              } else if (data.done) {
                pendingDone = data.message_id || "";
                pendingStats = {
                  latency_ms: data.latency_ms,
                  tokens_in: data.tokens_in,
                  tokens_out: data.tokens_out,
                  cost: data.cost,
                };
              } else if (data.error) {
                onError(data.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        if (pendingDone !== null) {
          onDone(pendingDone, pendingStats);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — notify backend
          fetch(`/api/conversations/${conversationId}/cancel`, { method: "POST" }).catch(() => {});
        } else {
          onError(err instanceof Error ? err.message : "Stream error");
        }
      } finally {
        if (typewriterRef.current) clearTimeout(typewriterRef.current);
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    if (typewriterRef.current) clearTimeout(typewriterRef.current);
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, startStream, cancel };
}
