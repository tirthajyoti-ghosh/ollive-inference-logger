import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- Formatting helpers ---------------------------------------------------

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatCurrency(usd: number): string {
  if (usd < 0.01 && usd > 0) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatTokens(n: number): string {
  return formatNumber(n);
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1_000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "paused":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "cancelled":
      return "bg-red-500/15 text-red-400 border-red-500/20";
    case "completed":
      return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}
