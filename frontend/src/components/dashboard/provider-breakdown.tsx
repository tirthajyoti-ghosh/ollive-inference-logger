"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ProviderBreakdown as PB } from "@/lib/api";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "oklch(0.55 0.1 160)",
  anthropic: "oklch(0.55 0.12 40)",
  groq: "oklch(0.6 0.14 25)",
};

const FALLBACK_COLORS = [
  "var(--olive)",
  "var(--info)",
  "var(--warn)",
  "var(--ok)",
  "var(--err)",
];

function getColor(provider: string, index: number) {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="card-lg" style={{ padding: "8px 12px", fontSize: 12 }}>
      <span style={{ color: "var(--ink)" }} className="font-mono font-medium">
        {d.name}: {d.value}
      </span>
    </div>
  );
}

interface ProviderBreakdownProps {
  data: PB[];
  loading?: boolean;
}

export function ProviderBreakdownChart({ data, loading }: ProviderBreakdownProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-32 rounded bg-[var(--bg-2)] animate-pulse mb-4" />
        <div className="h-52 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.provider.charAt(0).toUpperCase() + d.provider.slice(1),
    value: d.count,
    rawProvider: d.provider,
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card-lg p-6">
      <h3 className="font-semibold mb-5" style={{ fontSize: 13.5, color: "var(--ink)" }}>
        Provider Breakdown
      </h3>

      {/* Donut with center label */}
      <div className="relative h-[176px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(entry.rawProvider, index)}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>
            Total
          </span>
          <span
            className="font-mono font-semibold"
            style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.02em" }}
          >
            {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2.5 mt-4">
        {chartData.map((entry, i) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={entry.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: getColor(entry.rawProvider, i) }}
                />
                <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>
                  {entry.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {pct}%
                </span>
                <span className="font-mono font-medium" style={{ fontSize: 12, color: "var(--ink)" }}>
                  {entry.value.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
