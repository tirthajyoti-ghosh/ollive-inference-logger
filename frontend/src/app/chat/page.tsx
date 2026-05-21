"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation, getConversations, type Conversation } from "@/lib/api";
import { ProviderSelector } from "@/components/chat/provider-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Plus,
  ArrowRight,
  Zap,
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
        <div className="text-center space-y-4 animate-fade-up">
          <div className="flex items-center justify-center">
            <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-primary/[0.08] glow-amber">
              <div className="absolute inset-0 rounded-3xl bg-primary/[0.04] blur-xl" />
              <Zap className="relative h-9 w-9 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">New Conversation</h1>
          <p className="text-muted-foreground/80 text-sm max-w-md mx-auto leading-relaxed">
            Select a provider and model to start a new inference conversation.
            All messages are logged and tracked.
          </p>
        </div>

        {/* New conversation form */}
        <div className="glass-card gradient-border rounded-2xl p-6 space-y-5 animate-fade-up stagger-2">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
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
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this conversation a name..."
              className="h-10 bg-white/[0.03] border-white/[0.06] focus:border-primary/30 focus:ring-primary/20 transition-colors"
            />
          </div>

          <Button
            onClick={handleNewConversation}
            disabled={!provider || !model || creating}
            className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all"
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
        </div>

        {/* Recent conversations */}
        {recents.length > 0 && (
          <div className="space-y-3 animate-fade-up stagger-3">
            <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Recent Conversations
            </h2>
            <div className="space-y-2">
              {recents.map((conv) => (
                <div
                  key={conv.id}
                  className="glass-card rounded-2xl p-4 cursor-pointer group"
                  onClick={() => router.push(`/chat/${conv.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
                        <span className="text-[10px] text-muted-foreground/60">
                          {conv.message_count} messages
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatTokens(conv.total_tokens)} tokens
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatCurrency(conv.total_cost_usd)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/60">
                        {relativeTime(conv.updated_at)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-primary/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
