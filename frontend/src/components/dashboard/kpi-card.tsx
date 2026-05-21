"use client";

import type { LucideIcon } from "lucide-react";

/* ── Sparkline SVG ──────────────────────────────────────────────────── */

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

function Sparkline({ data, color, width = 88, height = 28 }: SparklineProps) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  // Closed polygon for gradient fill
  const fillPoints = `0,${height} ${polyline} ${width},${height}`;

  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── KpiCard ────────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaPositive?: boolean;
  sparkData?: number[];
  sparkColor?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaPositive,
  sparkData,
  sparkColor = "var(--olive)",
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="card-lg p-5 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-[7px] animate-pulse"
              style={{ width: 28, height: 28, background: "var(--bg-2)" }}
            />
            <div className="h-3 w-16 rounded bg-[var(--bg-2)] animate-pulse" />
          </div>
        </div>
        <div className="h-7 w-24 rounded bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card-lg p-5 flex flex-col gap-3 relative overflow-hidden">
      {/* Top row: icon + label + delta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-[7px]"
            style={{ width: 28, height: 28, background: iconBg }}
          >
            <Icon style={{ width: 15, height: 15, color: iconColor }} strokeWidth={2} />
          </div>
          <span
            className="font-medium"
            style={{ fontSize: "12.5px", color: "var(--muted-foreground)" }}
          >
            {label}
          </span>
        </div>

        {delta && (
          <span
            className="font-mono inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5"
            style={{
              fontSize: 11,
              background: deltaPositive ? "var(--ok-soft)" : "var(--err-soft)",
              color: deltaPositive
                ? "oklch(0.32 0.07 150)"
                : "oklch(0.4 0.1 25)",
            }}
          >
            {deltaPositive ? "↑" : "↓"} {delta}
          </span>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-mono font-semibold leading-none"
          style={{
            fontSize: 28,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="font-medium"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute right-3 bottom-3">
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>
  );
}
