"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation, getConversations, getProviders, type Conversation } from "@/lib/api";
import {
  MessageSquare,
  Plus,
  ArrowRight,
  Check,
} from "lucide-react";
import { relativeTime, formatTokens, formatCurrency } from "@/lib/utils";

/* ── Provider icon placeholder ────────────────────────────────────────── */
function ProviderIcon({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase();
  const bg =
    name === "openai"
      ? "oklch(0.55 0.1 160)"
      : name === "anthropic"
      ? "oklch(0.55 0.12 40)"
      : "oklch(0.6 0.14 25)";
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-semibold text-white"
      style={{ background: bg }}
    >
      {letter}
    </span>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [recents, setRecents] = useState<Conversation[]>([]);
  const [providers, setProviders] = useState<Record<string, string[]>>({});
  const [configured, setConfigured] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    getConversations("active", 0, 5)
      .then((data) => setRecents(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getProviders()
      .then((data) => {
        setProviders(data.providers);
        setConfigured(data.configured || []);
        const firstAvailable = (data.configured || []).find((p) => data.providers[p]?.length);
        if (firstAvailable) {
          setSelectedProvider(firstAvailable);
          setProvider(firstAvailable);
          const models = data.providers[firstAvailable];
          if (models?.length) {
            setSelectedModel(models[0]);
            setModel(models[0]);
          }
        }
      })
      .catch(() => {
        setProviders({
          openai: ["gpt-4o", "gpt-4o-mini"],
          anthropic: ["claude-sonnet-4-20250514"],
        });
      });
  }, []);

  const providerKeys = Object.keys(providers);
  const models = providers[selectedProvider] || [];

  const handleSelectProvider = (p: string) => {
    setSelectedProvider(p);
    setProvider(p);
    const m = providers[p];
    if (m?.length) {
      setSelectedModel(m[0]);
      setModel(m[0]);
    }
  };

  const handleSelectModel = (m: string) => {
    setSelectedModel(m);
    setModel(m);
  };

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
    <div className="page-enter max-w-[1280px] mx-auto px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--ink)" }}>
          New conversation
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
          Select a provider and model, then start chatting. Every request is logged.
        </p>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-8">
          <div className="card-lg p-7 space-y-6">
            {/* Provider selector cards */}
            <div>
              <label
                className="block text-[11.5px] font-medium uppercase tracking-wider mb-3"
                style={{ color: "var(--muted-foreground)" }}
              >
                Provider
              </label>
              <div className="grid grid-cols-3 gap-3">
                {providerKeys.map((p) => {
                  const isActive = selectedProvider === p;
                  const isAvailable = configured.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => isAvailable && handleSelectProvider(p)}
                      disabled={!isAvailable}
                      className="relative flex items-center gap-3 p-3.5 rounded-[12px] text-left transition-all"
                      style={{
                        background: isActive ? "var(--olive-soft)" : "var(--surface)",
                        border: `1.5px solid ${isActive ? "var(--olive)" : "var(--border)"}`,
                        boxShadow: isActive
                          ? "0 0 0 3px oklch(0.78 0.06 130 / 0.2)"
                          : "var(--shadow-sm)",
                        opacity: isAvailable ? 1 : 0.4,
                        cursor: isAvailable ? "pointer" : "not-allowed",
                      }}
                    >
                      <ProviderIcon name={p} />
                      <div>
                        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </div>
                        <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                          {isAvailable
                            ? `${providers[p]?.length || 0} model${(providers[p]?.length || 0) !== 1 ? "s" : ""}`
                            : "No API key"}
                        </div>
                      </div>
                      {isActive && isAvailable && (
                        <span
                          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "var(--olive)", color: "#fff" }}
                        >
                          <Check size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model selector */}
            {models.length > 0 && (
              <div>
                <label
                  className="block text-[11.5px] font-medium uppercase tracking-wider mb-3"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Model
                </label>
                <div className="rounded-[10px] p-1" style={{ background: "var(--surface-2)" }}>
                  {models.map((m) => {
                    const isActive = selectedModel === m;
                    return (
                      <button
                        key={m}
                        onClick={() => handleSelectModel(m)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left transition-all cursor-pointer"
                        style={{
                          background: isActive ? "var(--olive-soft)" : "transparent",
                        }}
                      >
                        {/* Radio dot */}
                        <span
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{
                            borderColor: isActive ? "var(--olive)" : "var(--border-strong)",
                          }}
                        >
                          {isActive && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: "var(--olive)" }}
                            />
                          )}
                        </span>
                        <span
                          className="font-mono text-[13px] flex-1"
                          style={{ color: "var(--ink)" }}
                        >
                          {m}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Title input */}
            <div>
              <label
                className="block text-[11.5px] font-medium uppercase tracking-wider mb-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this conversation a name..."
                className="input-custom"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-[12px]" style={{ color: "var(--faint)" }}>
                Logged automatically — every request, token, and ms.
              </span>
              <button
                onClick={handleNewConversation}
                disabled={!provider || !model || creating}
                className="btn btn-primary"
                style={{
                  opacity: !provider || !model || creating ? 0.5 : 1,
                  cursor: !provider || !model || creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    Start conversation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Recent conversations */}
          <div className="card-lg">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                Recent
              </h2>
              <button
                onClick={() => router.push("/conversations")}
                className="text-[12.5px] font-medium"
                style={{ color: "var(--olive-fg)" }}
              >
                View all
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {recents.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                    No recent conversations
                  </p>
                </div>
              )}
              {recents.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full text-left px-5 py-3 transition-colors cursor-pointer"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => router.push(`/chat/${conv.id}`)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                        {conv.title || `${conv.provider}/${conv.model}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              conv.status === "active"
                                ? "var(--ok)"
                                : conv.status === "paused"
                                ? "var(--warn)"
                                : "var(--faint)",
                          }}
                        />
                        <span className="font-mono text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                          {conv.model}
                        </span>
                        <span className="font-mono text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                          {conv.message_count}msg
                        </span>
                        <span className="font-mono text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                          {formatTokens(conv.total_tokens)}tok
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] shrink-0 mt-0.5" style={{ color: "var(--faint)" }}>
                      {relativeTime(conv.updated_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Hint card */}
          <div className="card p-5">
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              <strong style={{ color: "var(--ink)" }}>Tip:</strong>{" "}
              All conversations are logged with full token counts, latency, and cost
              tracking. Visit the dashboard for real-time analytics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
