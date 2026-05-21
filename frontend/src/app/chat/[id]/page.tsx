"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { getConversation, type Conversation } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { StreamingPlaceholder } from "@/components/chat/streaming-message";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { statusColor } from "@/lib/utils";

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
        <div className="glass border-b border-white/[0.04] px-6 py-4">
          <Skeleton className="h-5 w-48 bg-white/[0.05]" />
          <Skeleton className="h-3 w-32 mt-2 bg-white/[0.05]" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-16 w-3/5 bg-white/[0.03]" />
          <Skeleton className="h-16 w-2/5 ml-auto bg-white/[0.03]" />
          <Skeleton className="h-16 w-3/5 bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6">
        <div className="glass-card rounded-2xl p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm font-medium hover:bg-white/[0.06] transition-colors"
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
      <header className="glass border-b border-white/[0.04] px-4 md:px-6 py-3 flex items-center gap-3 shrink-0">
        <Link
          href="/conversations"
          className="inline-flex items-center justify-center rounded-xl h-8 w-8 shrink-0 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {conversation?.title || "Untitled Conversation"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px] bg-white/[0.04] border border-white/[0.06]">
              {provider}/{model}
            </Badge>
            {conversation && (
              <Badge
                variant="outline"
                className={`text-[10px] ${statusColor(conversation.status)}`}
              >
                {conversation.status}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-6">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-20">
              <p className="text-muted-foreground/60 text-sm">
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
            <div className="glass-card rounded-xl flex items-center gap-2 text-xs text-destructive px-4 py-3">
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
      />
    </div>
  );
}
