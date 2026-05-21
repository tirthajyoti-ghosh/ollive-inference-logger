"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint, LatencyStats } from "@/lib/api";

function formatTick(timestamp: unknown) {
  const d = new Date(String(timestamp));
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const tooltipStyle = {
  backgroundColor: "rgba(12,12,17,0.9)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.6)",
};

const axisTick = { fontSize: 10, fill: "#71717a" };

const activeDot = { r: 4, fill: "#f59e0b", stroke: "#07070a", strokeWidth: 2 };

interface LatencyTimeseriesProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function LatencyTimeseriesChart({ data, loading }: LatencyTimeseriesProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-4 w-40 mb-5 bg-white/5" />
        <Skeleton className="h-72 w-full rounded-lg bg-white/5" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Latency Over Time</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTick}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              label={{ value: "ms", position: "insideLeft", offset: 20, fontSize: 10, fill: "#71717a" }}
            />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={formatTick} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={activeDot}
              name="P50 Latency (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-4 w-40 mb-5 bg-white/5" />
        <Skeleton className="h-72 w-full rounded-lg bg-white/5" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Latency by Model</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.map(d => ({ ...d, label: `${d.provider}/${d.model}` }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="p50" fill="#f59e0b" radius={[4, 4, 0, 0]} name="P50" />
            <Bar dataKey="p95" fill="#38bdf8" radius={[4, 4, 0, 0]} name="P95" />
            <Bar dataKey="p99" fill="#fb7185" radius={[4, 4, 0, 0]} name="P99" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
