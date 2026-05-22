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

/* ── Provider logos ───────────────────────────────────────────────────── */
const PROVIDER_LOGOS: Record<string, React.ReactNode> = {
  openai: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934 4.1 4.1 0 0 0-1.778-.16 4.15 4.15 0 0 0-2.118-.114 4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679 4 4 0 0 0-1.139 1.254 3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z"/>
    </svg>
  ),
  anthropic: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
    </svg>
  ),
  groq: (
    <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
      <path d="M256.867 16.007c-92.47-.84-167.997 71.999-168.861 162.741-.84 90.767 73.319 164.926 165.789 165.766h58.08V282.93h-55.008c-57.767.672-105.118-44.784-105.79-101.519-.696-56.687 45.623-103.15 103.39-103.822h2.4c57.767 0 104.59 45.96 104.758 102.67v151.318c0 56.207-46.655 101.998-103.75 102.694a104.988 104.988 0 01-72.79-30.047l-44.424 43.63c30.983 30.432 72.599 47.712 116.038 48.144h2.208c91.27-1.344 164.59-73.99 165.093-163.581V176.42c-2.232-89.302-76.39-160.413-167.133-160.413z"/>
    </svg>
  ),
  gemini: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
    </svg>
  ),
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d4a27f",
  groq: "#f55036",
  gemini: "#4285f4",
};

function ProviderIcon({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white"
      style={{ background: PROVIDER_COLORS[name] || "oklch(0.55 0.1 160)" }}
    >
      {PROVIDER_LOGOS[name] || name.charAt(0).toUpperCase()}
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
