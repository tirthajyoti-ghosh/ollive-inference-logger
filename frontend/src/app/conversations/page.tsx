"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getConversations,
  updateConversation,
  deleteConversation,
  type Conversation,
} from "@/lib/api";
import {
  MessageSquare,
  Pause,
  Play,
  Trash2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Plus,
  Search,
} from "lucide-react";
import {
  statusColor,
  formatTokens,
  formatCurrency,
  formatTimestamp,
} from "@/lib/utils";

const PAGE_SIZE = 20;
const STATUS_TABS = ["all", "active", "paused", "completed", "cancelled"] as const;

function ConversationsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

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

  // Client-side search filter
  const filtered = searchQuery.trim()
    ? conversations.filter((c) =>
        (c.title ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.model.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

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

  // Summary stats
  const activeCount = conversations.filter((c) => c.status === "active").length;
  const totalTokens = conversations.reduce((s, c) => s + c.total_tokens, 0);
  const totalCost = conversations.reduce((s, c) => s + c.total_cost_usd, 0);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="page-enter max-w-[1280px] mx-auto px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--ink)" }}>
            Conversations
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
            {total} conversation{total !== 1 ? "s" : ""}
            {" · "}
            {activeCount} active
            {" · "}
            {formatTokens(totalTokens)} tokens
            {" · "}
            {formatCurrency(totalCost)} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-icon"
            onClick={fetchConversations}
            title="Refresh"
          >
            <RotateCw size={15} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/chat")}
          >
            <Plus size={15} />
            New chat
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card-lg p-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-custom py-2 text-[13px]"
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* Segmented status */}
        <div className="segmented">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "active" : ""}
              onClick={() => {
                setStatusFilter(s);
                setPage(0);
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-[10px] animate-pulse"
              style={{ background: "var(--bg-2)" }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-lg p-12 text-center">
          <MessageSquare
            className="h-10 w-10 mx-auto mb-3"
            style={{ color: "var(--faint)" }}
          />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No conversations found
          </p>
        </div>
      ) : (
        <div className="card-lg overflow-hidden">
          {/* Header row */}
          <div
            className="hidden lg:grid lg:grid-cols-[1fr_150px_90px_80px_80px_80px_100px] gap-4 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider"
            style={{
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
              color: "var(--muted-foreground)",
            }}
          >
            <span>Conversation</span>
            <span>Provider / Model</span>
            <span>Status</span>
            <span className="text-right">Messages</span>
            <span className="text-right">Tokens</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          {filtered.map((conv) => (
            <div
              key={conv.id}
              className="lg:grid lg:grid-cols-[1fr_150px_90px_80px_80px_80px_100px] lg:gap-4 lg:items-center flex flex-col gap-2 px-5 py-3 cursor-pointer transition-colors"
              style={{ borderBottom: "1px solid var(--border)" }}
              onClick={() => router.push(`/chat/${conv.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Conversation */}
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {conv.title || "Untitled"}
                </p>
                <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--faint)" }}>
                  {conv.id.slice(0, 8)} · {formatTimestamp(conv.created_at)}
                </p>
              </div>

              {/* Provider / Model */}
              <span className="badge badge-olive text-[10.5px] w-fit">
                {conv.provider}/{conv.model}
              </span>

              {/* Status */}
              <span className={`badge ${statusColor(conv.status)} w-fit`}>
                {conv.status}
              </span>

              {/* Messages */}
              <p
                className="text-[13px] text-right font-mono"
                style={{ color: "var(--ink)" }}
              >
                {conv.message_count}
              </p>

              {/* Tokens */}
              <p
                className="text-[13px] text-right font-mono"
                style={{ color: "var(--ink)" }}
              >
                {formatTokens(conv.total_tokens)}
              </p>

              {/* Cost */}
              <p
                className="text-[13px] text-right font-mono"
                style={{ color: "var(--ink)" }}
              >
                {formatCurrency(conv.total_cost_usd)}
              </p>

              {/* Actions */}
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {(conv.status === "paused" || conv.status === "cancelled") && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    title="Resume"
                    onClick={() => handleStatusChange(conv.id, "active")}
                  >
                    <Play size={14} style={{ color: "var(--ok)" }} />
                  </button>
                )}
                {conv.status === "active" && (
                  <>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="Pause"
                      onClick={() => handleStatusChange(conv.id, "paused")}
                    >
                      <Pause size={14} style={{ color: "var(--warn)" }} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="Cancel"
                      onClick={() => handleStatusChange(conv.id, "cancelled")}
                    >
                      <XCircle size={14} style={{ color: "var(--err)" }} />
                    </button>
                  </>
                )}
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  title="Delete"
                  onClick={() => handleDelete(conv.id)}
                >
                  <Trash2 size={14} style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              className="btn btn-outline btn-sm btn-icon"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              style={{ opacity: page === 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={15} />
            </button>
            {/* Page number buttons */}
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = i;
              return (
                <button
                  key={pageNum}
                  className="btn btn-sm"
                  style={{
                    background: page === pageNum ? "var(--olive-soft)" : "var(--surface)",
                    color: page === pageNum ? "var(--olive-fg)" : "var(--ink-2)",
                    border: `1px solid ${page === pageNum ? "oklch(0.85 0.05 130)" : "var(--border)"}`,
                    minWidth: 32,
                    justifyContent: "center",
                  }}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              className="btn btn-outline btn-sm btn-icon"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default function ConversationsPage() {
  return (
    <Suspense>
      <ConversationsInner />
    </Suspense>
  );
}
