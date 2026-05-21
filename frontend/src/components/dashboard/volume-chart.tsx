"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimeseriesPoint } from "@/lib/api";

const AXIS_TICK = {
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  fill: "oklch(0.55 0.012 80)",
};
const GRID = { stroke: "oklch(0.93 0.008 80)", strokeDasharray: "3 4" };
const AXIS_LINE = { stroke: "oklch(0.9 0.008 80)" };

const PROVIDER_COLORS = {
  openai: "oklch(0.55 0.1 160)",
  anthropic: "oklch(0.55 0.12 40)",
  groq: "oklch(0.6 0.14 25)",
};

function formatTick(timestamp: unknown) {
  const d = new Date(String(timestamp));
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-lg" style={{ padding: "10px 14px", fontSize: 12 }}>
      <p className="font-mono" style={{ color: "var(--muted-foreground)", marginBottom: 6 }}>
        {formatTick(label)}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span style={{ color: "var(--ink)" }} className="font-mono">
            {entry.name}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface VolumeChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function VolumeChart({ data, loading }: VolumeChartProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-32 rounded bg-[var(--bg-2)] animate-pulse mb-4" />
        <div className="h-64 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  // Detect provider keys from data (anything other than "timestamp" and "value")
  const providerKeys = data.length
    ? Object.keys(data[0]).filter(
        (k) => k !== "timestamp" && k !== "value"
      )
    : [];

  // If no per-provider keys, fall back to "value"
  const useProviders = providerKeys.length > 0;
  const areaKeys = useProviders ? providerKeys : ["value"];

  return (
    <div className="card-lg p-6">
      {/* Header with legend */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold" style={{ fontSize: 13.5, color: "var(--ink)" }}>
          Request Volume
        </h3>
        {useProviders && (
          <div className="flex items-center gap-4">
            {providerKeys.map((key) => {
              const color =
                PROVIDER_COLORS[key as keyof typeof PROVIDER_COLORS] ?? "var(--olive)";
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className="capitalize"
                    style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 500 }}
                  >
                    {key}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              {areaKeys.map((key) => {
                const color =
                  PROVIDER_COLORS[key as keyof typeof PROVIDER_COLORS] ?? "var(--olive)";
                return (
                  <linearGradient key={key} id={`vol-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.04} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTick}
              tick={AXIS_TICK}
              stroke={AXIS_LINE.stroke}
              tickLine={false}
              axisLine={AXIS_LINE}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            {areaKeys.map((key) => {
              const color =
                PROVIDER_COLORS[key as keyof typeof PROVIDER_COLORS] ?? "var(--olive)";
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="volume"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#vol-${key})`}
                  dot={false}
                  activeDot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 2 }}
                  name={key.charAt(0).toUpperCase() + key.slice(1)}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
