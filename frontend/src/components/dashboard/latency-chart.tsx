"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { TimeseriesPoint, LatencyStats } from "@/lib/api";

const AXIS_TICK = {
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  fill: "oklch(0.55 0.012 80)",
};
const GRID = { stroke: "oklch(0.93 0.008 80)", strokeDasharray: "3 4" };
const AXIS_LINE = { stroke: "oklch(0.9 0.008 80)" };

const P50_COLOR = "oklch(0.55 0.09 130)";
const P95_COLOR = "oklch(0.62 0.1 235)";
const P99_COLOR = "oklch(0.6 0.15 25)";

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
            {entry.name}: {Number(entry.value).toFixed(1)}ms
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Latency timeseries ─────────────────────────────────────────────── */

interface LatencyTimeseriesProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function LatencyTimeseriesChart({ data, loading }: LatencyTimeseriesProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-40 rounded bg-[var(--bg-2)] animate-pulse mb-5" />
        <div className="h-72 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card-lg p-6">
      {/* Header with legend */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold" style={{ fontSize: 13.5, color: "var(--ink)" }}>
          Latency Over Time
        </h3>
        <div className="flex items-center gap-4">
          {[
            { label: "P50", color: P50_COLOR },
            { label: "P95", color: P95_COLOR },
            { label: "P99", color: P99_COLOR, dashed: true },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 rounded"
                style={{
                  height: 2,
                  background: l.color,
                  ...(l.dashed
                    ? { backgroundImage: `repeating-linear-gradient(90deg, ${l.color} 0 4px, transparent 4px 7px)`, background: "none" }
                    : {}),
                }}
              />
              <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              label={{
                value: "ms",
                position: "insideLeft",
                offset: 20,
                style: { ...AXIS_TICK, fontSize: 10 },
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={P50_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: P50_COLOR, stroke: "#fff", strokeWidth: 2 }}
              name="P50"
            />
            {/* If the data carries p95/p99 keys, render them */}
            <Line
              type="monotone"
              dataKey="p95"
              stroke={P95_COLOR}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: P95_COLOR, stroke: "#fff", strokeWidth: 2 }}
              name="P95"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="p99"
              stroke={P99_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3, fill: P99_COLOR, stroke: "#fff", strokeWidth: 2 }}
              name="P99"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Latency by model (horizontal bar) ──────────────────────────────── */

function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-lg" style={{ padding: "8px 12px", fontSize: 12 }}>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span style={{ color: "var(--ink)" }} className="font-mono">
            {entry.name}: {Number(entry.value).toFixed(1)}ms
          </span>
        </div>
      ))}
    </div>
  );
}

interface LatencyByModelProps {
  data: LatencyStats[];
  loading?: boolean;
}

export function LatencyByModelChart({ data, loading }: LatencyByModelProps) {
  if (loading) {
    return (
      <div className="card-lg p-6">
        <div className="h-4 w-40 rounded bg-[var(--bg-2)] animate-pulse mb-5" />
        <div className="h-72 w-full rounded-xl bg-[var(--bg-2)] animate-pulse" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: `${d.provider}/${d.model}`,
  }));

  return (
    <div className="card-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold" style={{ fontSize: 13.5, color: "var(--ink)" }}>
          Latency by Model
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: "var(--olive-soft)", border: "1px solid var(--olive)" }} />
            <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 500 }}>P50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: "var(--olive)" }} />
            <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 500 }}>P95</span>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid {...GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={AXIS_LINE}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ ...AXIS_TICK, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip content={<BarTooltip />} />
            <Bar
              dataKey="p50"
              fill="var(--olive-soft)"
              stroke="var(--olive)"
              strokeWidth={1}
              radius={[0, 4, 4, 0]}
              name="P50"
              barSize={14}
            />
            <Bar
              dataKey="p95"
              fill="var(--olive)"
              radius={[0, 4, 4, 0]}
              name="P95"
              barSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
