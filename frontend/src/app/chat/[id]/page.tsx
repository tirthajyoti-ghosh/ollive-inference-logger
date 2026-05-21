"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { getConversation, type Conversation } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { StreamingPlaceholder } from "@/components/chat/streaming-message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  AlertCircle,
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

  const provider = conversation?.provider ?? "";
  const model = conversation?.model ?? "";

  const { messages, isStreaming, error, sendMessage, cancel, hydrate } =
    useChat(id, provider, model);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation
  useEffect(() => {
    setLoading(true);
    getConversation(id)
      .then((conv) => {
        setConversation(conv);
        if (conv.messages) {
          hydrate(conv.messages);
        }
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id, hydrate]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="px-6 py-3" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <Skeleton className="h-5 w-48" style={{ background: "var(--bg-2)" }} />
          <Skeleton className="h-3 w-32 mt-2" style={{ background: "var(--bg-2)" }} />
        </div>
        <div className="flex-1 p-6 space-y-4" style={{ background: "var(--background)" }}>
          <Skeleton className="h-16 w-3/5" style={{ background: "var(--bg-2)" }} />
          <Skeleton className="h-16 w-2/5 ml-auto" style={{ background: "var(--bg-2)" }} />
          <Skeleton className="h-16 w-3/5" style={{ background: "var(--bg-2)" }} />
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
          <Link
            href="/chat"
            className="btn btn-outline inline-flex"
          >
            Back to Chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center gap-3 shrink-0"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link
          href="/conversations"
          className="btn-ghost btn-icon rounded-lg shrink-0 inline-flex items-center justify-center h-8 w-8"
        >
          <ChevronLeft size={16} style={{ color: "var(--ink-2)" }} />
        </Link>

        <div className="flex-1 min-w-0">
          <h1
            className="text-[15px] font-medium truncate"
            style={{ color: "var(--ink)" }}
          >
            {conversation?.title || "Untitled Conversation"}
          </h1>
        </div>

        {/* Status badge */}
        {conversation && (
          <span className={`badge ${statusColor(conversation.status)}`}>
            {conversation.status}
          </span>
        )}

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-3 ml-2">
          <span className="badge badge-olive text-[10.5px]">
            {provider}/{model}
          </span>
          <span className="font-mono text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
            {messages.length} msg
          </span>
          <span className="font-mono text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
            {formatTokens(conversation?.total_tokens ?? 0)} tok
          </span>
          <span className="font-mono text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
            {formatCurrency(conversation?.total_cost_usd ?? 0)}
          </span>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef} style={{ background: "var(--background)" }}>
        <div className="max-w-[820px] mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                No messages yet. Start the conversation below.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Show thinking placeholder when streaming with no content yet */}
          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" &&
            messages[messages.length - 1].content === "" && (
              <StreamingPlaceholder />
            )}

          {error && (
            <div
              className="card flex items-center gap-2 text-xs px-4 py-3"
              style={{ color: "var(--err)" }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onCancel={cancel}
        isStreaming={isStreaming}
        disabled={conversation?.status !== "active"}
        providerLabel={provider && model ? `${provider}/${model}` : undefined}
      />
    </div>
  );
}
