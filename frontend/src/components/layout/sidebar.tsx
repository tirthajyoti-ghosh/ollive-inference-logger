"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  List,
  BarChart3,
  Clock,
  Activity,
  AlertTriangle,
  Settings,
  Hash,
  Search,
  ExternalLink,
} from "lucide-react";

function NavItem({
  href,
  icon,
  label,
  active,
  badge,
  indent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px] transition-colors"
      style={{
        color: active ? "var(--ink)" : "var(--ink-2)",
        background: active ? "var(--surface)" : "transparent",
        border: `1px solid ${active ? "var(--border)" : "transparent"}`,
        boxShadow: active ? "var(--shadow-sm)" : "none",
        fontWeight: active ? 500 : 400,
        marginLeft: indent ? 22 : 0,
      }}
    >
      <span className="shrink-0" style={{ color: active ? "var(--olive-fg)" : "var(--muted-foreground)" }}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className="ml-auto text-[11px] font-mono px-1.5 py-px rounded-[5px]"
          style={{ background: active ? "var(--bg-2)" : "transparent", color: "var(--muted-foreground)" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div
        className="px-2.5 mb-1 text-[10.5px] font-medium uppercase tracking-[0.08em]"
        style={{ color: "var(--faint)" }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const is = (path: string) => pathname === path || pathname.startsWith(path + "/");
  const dashSection = pathname.startsWith("/dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [convoCount, setConvoCount] = useState(0);
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; latencyMs: number | null }>({ ok: false, latencyMs: null });
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch conversation count
  useEffect(() => {
    fetch("/api/conversations?offset=0&limit=1")
      .then((r) => r.json())
      .then((d) => setConvoCount(d.total ?? 0))
      .catch(() => {});
  }, [pathname]);

  // Health check ping
  useEffect(() => {
    let mounted = true;
    const ping = async () => {
      const start = performance.now();
      try {
        const res = await fetch("/api/health");
        const latencyMs = Math.round(performance.now() - start);
        if (mounted) setApiStatus({ ok: res.ok, latencyMs });
      } catch {
        if (mounted) setApiStatus({ ok: false, latencyMs: null });
      }
    };
    ping();
    const interval = setInterval(ping, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Navigate to conversations with search query on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/conversations?q=${encodeURIComponent(searchQuery.trim())}`);
    }
    if (e.key === "Escape") {
      setSearchQuery("");
      searchRef.current?.blur();
    }
  };

  return (
    <aside
      className="hidden md:flex w-[232px] shrink-0 border-r flex-col sticky top-0 h-screen"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      {/* Brand */}
      <div className="px-4 pt-4 pb-3">
        <Link href="/chat" className="flex items-center gap-2 group">
          <span
            className="w-7 h-7 rounded-lg grid place-items-center"
            style={{
              background: "var(--olive)",
              boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.18), 0 1px 2px oklch(0.4 0.05 130 / 0.2)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 16c0-5 4-10 9-12-1 5-3 10-7 12-1 0-2 0-2 0z" fill="#fff" fillOpacity="0.95" />
              <path d="M14 4c5 2 7 7 5 14-4-2-7-7-5-14z" fill="#fff" fillOpacity="0.75" />
            </svg>
          </span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[14.5px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
              Ollive
            </span>
            <span className="text-[10.5px] -mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Inference Logger
            </span>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 mb-3">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full rounded-lg border text-[12.5px] focus:outline-none"
            style={{
              background: "var(--surface)",
              borderColor: searchQuery ? "var(--olive-ring)" : "var(--border)",
              color: "var(--ink)",
              padding: "6px 10px 6px 30px",
              boxShadow: searchQuery ? "0 0 0 3px oklch(0.78 0.06 130 / 0.25)" : "none",
            }}
          />
          {!searchQuery && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
              <kbd className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded text-[10.5px] font-mono border" style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--ink-2)" }}>
                ⌘
              </kbd>
              <kbd className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded text-[10.5px] font-mono border" style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--ink-2)" }}>
                K
              </kbd>
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 flex-1 overflow-auto">
        <NavGroup label="Chat">
          <NavItem href="/chat" icon={<MessageSquare size={15} />} label="New chat" active={pathname === "/chat"} />
          <NavItem href="/conversations" icon={<List size={15} />} label="Conversations" badge={convoCount > 0 ? String(convoCount) : undefined} active={is("/conversations")} />
        </NavGroup>

        <div className="my-3 border-t" style={{ borderColor: "var(--border)" }} />

        <NavGroup label="Observability">
          <NavItem href="/dashboard" icon={<BarChart3 size={15} />} label="Overview" active={pathname === "/dashboard"} />
          <NavItem href="/dashboard/latency" icon={<Clock size={14} />} label="Latency" active={pathname === "/dashboard/latency"} indent />
          <NavItem href="/dashboard/throughput" icon={<Activity size={14} />} label="Throughput" active={pathname === "/dashboard/throughput"} indent />
          <NavItem href="/dashboard/errors" icon={<AlertTriangle size={14} />} label="Errors" active={pathname === "/dashboard/errors"} indent />
        </NavGroup>

        <div className="my-3 border-t" style={{ borderColor: "var(--border)" }} />

        <NavGroup label="Workspace">
          <NavItem href="#" icon={<Settings size={14} />} label="Settings" active={false} />
          <NavItem href="#" icon={<Hash size={14} />} label="API keys" active={false} />
        </NavGroup>
      </nav>

      {/* Status indicator */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative inline-flex">
              <span className="w-2 h-2 rounded-full pulse-ok" style={{ background: apiStatus.ok ? "oklch(0.62 0.11 150)" : "oklch(0.55 0.15 30)" }} />
            </span>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[11.5px] font-medium" style={{ color: "var(--ink)" }}>{apiStatus.ok ? "All systems normal" : "API unreachable"}</span>
              <span className="text-[10.5px] truncate font-mono" style={{ color: "var(--muted-foreground)" }}>
                {apiStatus.ok
                  ? `api · ${apiStatus.latencyMs}ms`
                  : "api · disconnected"}
              </span>
            </div>
          </div>
          <button className="hover:opacity-70" style={{ color: "var(--faint)" }} title="Status page">
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </aside>
  );
}
