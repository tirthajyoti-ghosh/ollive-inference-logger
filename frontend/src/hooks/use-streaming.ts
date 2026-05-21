"use client";

import { useCallback, useRef, useState } from "react";

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
}

export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (
      conversationId: string,
      content: string,
      provider: string,
      model: string,
      { onToken, onDone, onError }: StreamCallbacks
    ) => {
      // Abort any existing stream
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

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

          // Process complete SSE lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const json = trimmed.slice(6);
            try {
              const data = JSON.parse(json);
              if (data.token) {
                onToken(data.token);
              } else if (data.done) {
                onDone(data.message_id || "");
              } else if (data.error) {
                onError(data.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — not an error
        } else {
          onError(err instanceof Error ? err.message : "Stream error");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, startStream, cancel };
}
