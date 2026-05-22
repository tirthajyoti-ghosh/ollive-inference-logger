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

const OLIVE = "oklch(0.55 0.09 130)";
const INFO = "oklch(0.62 0.1 235)";
const GOLD = "oklch(0.72 0.12 75)";

function formatTick(timestamp: unknown) {
  const d = new Date(String(timestamp));
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-lg" style={{ padding: "10px 14px", fontSize: 12 }}>
      <p className="font-mono" style={{ color: "var(--muted-foreground)", marginBottom: 6 }}>
        {formatTick(label)}
      </p>
      {payload.map((entry: any) => {
        const val = formatter
          ? formatter(entry.value, entry.name)
          : entry.value;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2" style={{ marginBottom: 2 }}>
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span style={{ color: "var(--ink)" }} className="font-mono">
              {entry.name}: {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── RPM Chart ──────────────────────────────────────────────────────── */

interface RPMChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function RPMChart({ data, loading }: RPMChartProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-40 rounded bg-[var(--bg-2)] animate-pulse mb-5" />
        <div className="h-64 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  const showDots = data.length <= 2;

  return (
    <div className="card-lg p-6">
      <h3 className="font-semibold mb-5" style={{ fontSize: 13.5, color: "var(--ink)" }}>
        Requests per Minute
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rpmGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OLIVE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={OLIVE} stopOpacity={0.04} />
              </linearGradient>
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
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={OLIVE}
              strokeWidth={1.5}
              fill="url(#rpmGrad)"
              dot={showDots ? { r: 4, fill: OLIVE, stroke: "#fff", strokeWidth: 2 } : false}
              activeDot={{ r: 3, fill: OLIVE, stroke: "#fff", strokeWidth: 2 }}
              name="RPM"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Token Consumption (stacked area) ───────────────────────────────── */

interface TokenChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function TokenConsumptionChart({ data, loading }: TokenChartProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-40 rounded bg-[var(--bg-2)] animate-pulse mb-5" />
        <div className="h-64 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card-lg p-6">
      {/* Header with legend */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold" style={{ fontSize: 13.5, color: "var(--ink)" }}>
          Token Consumption
        </h3>
        <div className="flex items-center gap-4">
          {[
            { label: "Input", color: INFO },
            { label: "Output", color: OLIVE },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="promptGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INFO} stopOpacity={0.35} />
                <stop offset="100%" stopColor={INFO} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="completionGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OLIVE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={OLIVE} stopOpacity={0.04} />
              </linearGradient>
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
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="prompt_tokens"
              stackId="tokens"
              stroke={INFO}
              strokeWidth={1.5}
              fill="url(#promptGrad2)"
              name="Input"
            />
            <Area
              type="monotone"
              dataKey="completion_tokens"
              stackId="tokens"
              stroke={OLIVE}
              strokeWidth={1.5}
              fill="url(#completionGrad2)"
              name="Output"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Cost Chart ─────────────────────────────────────────────────────── */

interface CostChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function CostChart({ data, loading }: CostChartProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-40 rounded bg-[var(--bg-2)] animate-pulse mb-5" />
        <div className="h-64 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  const showDots = data.length <= 2;

  return (
    <div className="card-lg p-6">
      <h3 className="font-semibold mb-5" style={{ fontSize: 13.5, color: "var(--ink)" }}>
        Cost Over Time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="costGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.04} />
              </linearGradient>
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
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(val: number) => `$${Number(val).toFixed(4)}`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={GOLD}
              strokeWidth={1.5}
              fill="url(#costGrad2)"
              name="Cost (USD)"
              dot={showDots ? { r: 4, fill: GOLD, stroke: "#fff", strokeWidth: 2 } : false}
              activeDot={{ r: 3, fill: GOLD, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
