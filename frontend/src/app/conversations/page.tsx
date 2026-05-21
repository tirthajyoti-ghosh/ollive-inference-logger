"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getConversations,
  updateConversation,
  deleteConversation,
  type Conversation,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Pause,
  Play,
  Trash2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  statusColor,
  formatTokens,
  formatCurrency,
  formatTimestamp,
} from "@/lib/utils";

const PAGE_SIZE = 20;

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const status = statusFilter === "all" ? undefined : statusFilter;
      const data = await getConversations(status, page * PAGE_SIZE, PAGE_SIZE);
      setConversations(data.items);
      setTotal(data.total);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateConversation(id, { status: newStatus });
      fetchConversations();
    } catch {
      /* swallow */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      fetchConversations();
    } catch {
      /* swallow */
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {total} conversation{total !== 1 ? "s" : ""} total
          </p>
        </div>

        <div className="glass rounded-full px-1 py-1">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(0); }}>
            <SelectTrigger className="w-36 h-8 text-xs border-0 bg-transparent focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="paused" className="text-xs">Paused</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
              <SelectItem value="completed" className="text-xs">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/60">No conversations found</p>
        </div>
      ) : (
        <div className="space-y-2 animate-fade-up stagger-1">
          {/* Header row — desktop only */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_140px_80px_80px_80px_80px_130px] gap-4 px-4 py-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            <span>Title</span>
            <span>Provider / Model</span>
            <span>Status</span>
            <span className="text-right">Messages</span>
            <span className="text-right">Tokens</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Actions</span>
          </div>

          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="glass-card rounded-2xl px-4 py-3 cursor-pointer"
              onClick={() => router.push(`/chat/${conv.id}`)}
            >
              <div className="lg:grid lg:grid-cols-[1fr_140px_80px_80px_80px_80px_130px] lg:gap-4 lg:items-center flex flex-col gap-2">
                {/* Title */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conv.title || "Untitled"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {formatTimestamp(conv.created_at)}
                  </p>
                </div>

                {/* Provider / Model */}
                <Badge variant="secondary" className="text-[10px] w-fit bg-white/[0.04] border border-white/[0.06]">
                  {conv.provider}/{conv.model}
                </Badge>

                {/* Status */}
                <Badge
                  variant="outline"
                  className={`text-[10px] w-fit ${
                    conv.status === "active"
                      ? "border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_-2px_rgba(52,211,153,0.2)]"
                      : conv.status === "paused"
                      ? "border-amber-500/30 text-amber-400 shadow-[0_0_8px_-2px_rgba(245,158,11,0.2)]"
                      : conv.status === "cancelled"
                      ? "border-rose-500/30 text-rose-400 shadow-[0_0_8px_-2px_rgba(244,63,94,0.2)]"
                      : conv.status === "completed"
                      ? "border-sky-500/30 text-sky-400 shadow-[0_0_8px_-2px_rgba(56,189,248,0.2)]"
                      : statusColor(conv.status)
                  }`}
                >
                  {conv.status}
                </Badge>

                {/* Messages */}
                <p className="text-sm text-right metric-value">
                  {conv.message_count}
                </p>

                {/* Tokens */}
                <p className="text-sm text-right metric-value">
                  {formatTokens(conv.total_tokens)}
                </p>

                {/* Cost */}
                <p className="text-sm text-right metric-value">
                  {formatCurrency(conv.total_cost_usd)}
                </p>

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(conv.status === "paused" || conv.status === "cancelled") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-emerald-500/10"
                      title="Resume"
                      onClick={() => handleStatusChange(conv.id, "active")}
                    >
                      <Play className="h-3.5 w-3.5 text-emerald-400" />
                    </Button>
                  )}
                  {conv.status === "active" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-amber-500/10"
                        title="Pause"
                        onClick={() => handleStatusChange(conv.id, "paused")}
                      >
                        <Pause className="h-3.5 w-3.5 text-amber-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-rose-500/10"
                        title="Cancel"
                        onClick={() => handleStatusChange(conv.id, "cancelled")}
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-destructive/10"
                    title="Delete"
                    onClick={() => handleDelete(conv.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground/60">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="glass h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="glass h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
