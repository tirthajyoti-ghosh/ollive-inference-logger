"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { getConversation, type Conversation } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { StreamingPlaceholder } from "@/components/chat/streaming-message";
import {
  ChevronLeft,
  AlertCircle,
  Hash,
  Settings,
  MoreHorizontal,
  Clock,
  Square,
} from "lucide-react";
import { statusColor, formatTokens, formatCurrency } from "@/lib/utils";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const [streamTick, setStreamTick] = useState(0);

  const provider = conversation?.provider ?? "";
  const model = conversation?.model ?? "";

  const { messages, isStreaming, error, sendMessage, cancel, hydrate } =
    useChat(id, provider, model);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getConversation(id)
      .then((conv) => {
        setConversation(conv);
        if (conv.messages) hydrate(conv.messages);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id, hydrate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  // Track streaming elapsed time
  useEffect(() => {
    if (isStreaming) {
      setStreamStartedAt(Date.now());
      const iv = setInterval(() => setStreamTick((t) => t + 1), 100);
      return () => clearInterval(iv);
    } else {
      setStreamStartedAt(null);
      setStreamTick(0);
    }
  }, [isStreaming]);

  const streamingMsg = isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant"
    ? messages[messages.length - 1]
    : null;
  const streamTokens = streamingMsg ? Math.floor(streamingMsg.content.length / 4) : 0;
  const streamElapsedMs = streamStartedAt ? Date.now() - streamStartedAt : 0;
  const tokPerSec = streamTokens > 0 && streamElapsedMs > 100
    ? Math.round(streamTokens / (streamElapsedMs / 1000))
    : 0;

  // Suppress unused variable warning
  void streamTick;

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="px-6 py-3" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="h-5 w-48 rounded animate-pulse" style={{ background: "var(--bg-2)" }} />
          <div className="h-3 w-32 mt-2 rounded animate-pulse" style={{ background: "var(--bg-2)" }} />
        </div>
        <div className="flex-1 p-6 space-y-4" style={{ background: "var(--background)" }}>
          <div className="h-16 w-3/5 rounded-xl animate-pulse" style={{ background: "var(--bg-2)" }} />
          <div className="h-16 w-2/5 ml-auto rounded-xl animate-pulse" style={{ background: "var(--bg-2)" }} />
          <div className="h-16 w-3/5 rounded-xl animate-pulse" style={{ background: "var(--bg-2)" }} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6" style={{ background: "var(--background)" }}>
        <div className="card-lg p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="h-10 w-10 mx-auto" style={{ color: "var(--err)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{loadError}</p>
          <Link href="/chat" className="btn btn-outline inline-flex">Back to Chat</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen page-enter">
      {/* Header */}
      <div
        className="px-6 py-3 flex items-center gap-4 shrink-0"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <Link
          href="/conversations"
          className="btn btn-ghost btn-icon shrink-0"
          title="Back"
        >
          <ChevronLeft size={16} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-medium truncate" style={{ color: "var(--ink)" }}>
              {conversation?.title || "Untitled Conversation"}
            </h1>
            {conversation && (
              <span className={`badge ${statusColor(isStreaming ? "active" : conversation.status)}`}>
                {isStreaming ? "Active" : conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] font-mono" style={{ color: "var(--muted-foreground)" }}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border text-[11.5px] px-2 py-0.5"
              style={{ background: "oklch(0.96 0.02 130)", borderColor: "oklch(0.88 0.02 80)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--olive)" }} />
              <span className="font-medium" style={{ color: "var(--ink)" }}>{provider.charAt(0).toUpperCase() + provider.slice(1)}</span>
              <span className="opacity-70" style={{ color: "var(--ink-2)" }}>· {model}</span>
            </span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{messages.length} messages</span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{formatTokens(conversation?.total_tokens ?? 0)} tokens</span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{formatCurrency(conversation?.total_cost_usd ?? 0)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-icon"><Hash size={14} /></button>
          <button className="btn btn-ghost btn-icon"><Settings size={14} /></button>
          <button className="btn btn-ghost btn-icon"><MoreHorizontal size={14} /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
        <div className="max-w-[820px] mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                No messages yet. Start the conversation below.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isCurrent = isStreaming && i === messages.length - 1 && msg.role === "assistant";
            // Show thinking indicator if no thinking and no content yet
            if (isCurrent && !msg.content && !msg.thinking) return null;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isCurrent}
              />
            );
          })}

          {/* Thinking indicator — only when no thinking tokens have arrived yet */}
          {isStreaming && streamingMsg && !streamingMsg.content && !streamingMsg.thinking && (
            <StreamingPlaceholder />
          )}

          {/* Cancel control + live telemetry */}
          {isStreaming && (
            <div className="flex items-center gap-3 pt-1 pl-10">
              <button onClick={cancel} className="btn btn-danger btn-sm">
                <Square size={13} />
                Cancel
              </button>
              <div className="flex items-center gap-3 text-[11.5px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {streamElapsedMs >= 1000
                    ? (streamElapsedMs / 1000).toFixed(1) + "s"
                    : streamElapsedMs + "ms"}
                </span>
                <span>·</span>
                <span>{streamTokens} tok streamed</span>
                <span>·</span>
                <span>{tokPerSec} tok/s</span>
              </div>
            </div>
          )}

          {error && (
            <div className="card flex items-center gap-2 text-xs px-4 py-3" style={{ color: "var(--err)" }}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <ChatInput
        onSend={sendMessage}
        onCancel={cancel}
        isStreaming={isStreaming}
        disabled={conversation?.status !== "active"}
        providerLabel={provider && model ? `${provider} · ${model}` : undefined}
        modelName={model || undefined}
      />
    </div>
  );
}
