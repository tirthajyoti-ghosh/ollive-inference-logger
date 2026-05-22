"use client";

import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimeseriesPoint, ErrorBreakdown } from "@/lib/api";

const AXIS_TICK = {
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  fill: "oklch(0.55 0.012 80)",
};
const GRID = { stroke: "oklch(0.93 0.008 80)", strokeDasharray: "3 4" };
const AXIS_LINE = { stroke: "oklch(0.9 0.008 80)" };

const ERR_COLOR = "oklch(0.6 0.15 25)";

const DONUT_COLORS = [
  "oklch(0.6 0.15 25)",   // red
  "oklch(0.72 0.12 75)",  // warm gold
  "oklch(0.62 0.1 235)",  // blue
  "oklch(0.55 0.09 130)", // olive
  "oklch(0.6 0.14 25)",   // orange
];

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
            {entry.name}: {(Number(entry.value) * 100).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Error Rate Area Chart ──────────────────────────────────────────── */

interface ErrorRateChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function ErrorRateChart({ data, loading }: ErrorRateChartProps) {
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
      <h3 className="font-semibold mb-5" style={{ fontSize: 13.5, color: "var(--ink)" }}>
        Error Rate Over Time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ERR_COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={ERR_COLOR} stopOpacity={0.04} />
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
              tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={ERR_COLOR}
              strokeWidth={1.5}
              fill="url(#errGrad)"
              dot={false}
              activeDot={{ r: 3, fill: ERR_COLOR, stroke: "#fff", strokeWidth: 2 }}
              name="Error Rate"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Error Type Donut ───────────────────────────────────────────────── */

function DonutTooltip({ active, payload }: any) {
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

interface ErrorBreakdownChartProps {
  data: ErrorBreakdown[];
  loading?: boolean;
}

export function ErrorBreakdownChart({ data, loading }: ErrorBreakdownChartProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-40 rounded bg-[var(--bg-2)] animate-pulse mb-5" />
        <div className="h-64 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.error_type,
    value: d.count,
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card-lg p-6">
      <h3 className="font-semibold mb-5" style={{ fontSize: 13.5, color: "var(--ink)" }}>
        Error Type Breakdown
      </h3>

      <div className="flex items-start gap-6">
        {/* Donut */}
        <div className="relative" style={{ width: 176, height: 176, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 500 }}>
              Errors
            </span>
            <span
              className="font-mono font-semibold"
              style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.02em" }}
            >
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Side legend */}
        <div className="flex flex-col gap-3 pt-4 min-w-0 flex-1">
          {chartData.map((entry, i) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
            return (
              <div key={entry.name} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span
                    className="truncate"
                    style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}
                  >
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
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
    </div>
  );
}
