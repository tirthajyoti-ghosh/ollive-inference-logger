"use client";

import { useCallback, useState } from "react";
import { useStreaming, type StreamStats } from "./use-streaming";
import type { Message } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  created_at: string;
  streaming?: boolean;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
}

export function useChat(conversationId: string, provider: string, model: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { isStreaming, startStream, cancel } = useStreaming();

  const hydrate = useCallback((msgs: Message[]) => {
    setMessages(
      msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }))
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        thinking: "",
        created_at: new Date().toISOString(),
        streaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      await startStream(conversationId, content, provider, model, {
        onThinking: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, thinking: (m.thinking ?? "") + token }
                : m
            )
          );
        },
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + token }
                : m
            )
          );
        },
        onDone: (messageId, stats?: StreamStats) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    id: messageId || assistantId,
                    streaming: false,
                    latency_ms: stats?.latency_ms,
                    tokens_in: stats?.tokens_in,
                    tokens_out: stats?.tokens_out,
                    cost: stats?.cost,
                  }
                : m
            )
          );
        },
        onError: (err) => {
          setError(err);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || "Error occurred", streaming: false }
                : m
            )
          );
        },
      });
    },
    [conversationId, provider, model, startStream]
  );

  return { messages, isStreaming, error, sendMessage, cancel, hydrate };
}
