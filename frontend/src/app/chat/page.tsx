"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation, getConversations, type Conversation } from "@/lib/api";
import { ProviderSelector } from "@/components/chat/provider-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { relativeTime, statusColor, formatTokens, formatCurrency } from "@/lib/utils";

export default function ChatPage() {
  const router = useRouter();
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [recents, setRecents] = useState<Conversation[]>([]);

  useEffect(() => {
    getConversations("active", 0, 5)
      .then((data) => setRecents(data.items))
      .catch(() => {});
  }, []);

  const handleNewConversation = useCallback(async () => {
    if (!provider || !model) return;
    setCreating(true);
    try {
      const conv = await createConversation({
        provider,
        model,
        title: title.trim() || undefined,
      });
      router.push(`/chat/${conv.id}`);
    } catch {
      setCreating(false);
    }
  }, [provider, model, title, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 md:p-10">
      <div className="w-full max-w-2xl space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">New Conversation</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Select a provider and model to start a new inference conversation.
            All messages are logged and tracked.
          </p>
        </div>

        {/* New conversation form */}
        <Card className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Provider &amp; Model
            </label>
            <ProviderSelector
              provider={provider}
              model={model}
              onProviderChange={setProvider}
              onModelChange={setModel}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this conversation a name..."
              className="h-10"
            />
          </div>

          <Button
            onClick={handleNewConversation}
            disabled={!provider || !model || creating}
            className="w-full h-11"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Start Conversation
              </span>
            )}
          </Button>
        </Card>

        {/* Recent conversations */}
        {recents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent Conversations
            </h2>
            <div className="space-y-2">
              {recents.map((conv) => (
                <Card
                  key={conv.id}
                  className="p-4 hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/chat/${conv.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.title || `${conv.provider}/${conv.model}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statusColor(conv.status)}`}
                        >
                          {conv.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {conv.message_count} messages
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTokens(conv.total_tokens)} tokens
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatCurrency(conv.total_cost_usd)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(conv.updated_at)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
