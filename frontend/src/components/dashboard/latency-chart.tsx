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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint, LatencyStats } from "@/lib/api";

function formatTick(timestamp: unknown) {
  const d = new Date(String(timestamp));
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const tooltipStyle = {
  backgroundColor: "oklch(0.17 0.015 260)",
  border: "1px solid oklch(0.28 0.015 260)",
  borderRadius: "8px",
  fontSize: "12px",
};

interface LatencyTimeseriesProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function LatencyTimeseriesChart({ data, loading }: LatencyTimeseriesProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Latency Over Time</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 260)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTick}
              tick={{ fontSize: 10, fill: "oklch(0.65 0.01 260)" }}
              stroke="oklch(0.28 0.015 260)"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "oklch(0.65 0.01 260)" }}
              stroke="oklch(0.28 0.015 260)"
              label={{ value: "ms", position: "insideLeft", offset: 20, fontSize: 10, fill: "oklch(0.65 0.01 260)" }}
            />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={formatTick} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="oklch(0.72 0.15 230)"
              strokeWidth={2}
              dot={false}
              name="P50 Latency (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface LatencyByModelProps {
  data: LatencyStats[];
  loading?: boolean;
}

export function LatencyByModelChart({ data, loading }: LatencyByModelProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Latency by Model</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.map(d => ({ ...d, label: `${d.provider}/${d.model}` }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 260)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "oklch(0.65 0.01 260)" }}
              stroke="oklch(0.28 0.015 260)"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "oklch(0.65 0.01 260)" }}
              stroke="oklch(0.28 0.015 260)"
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="p50" fill="oklch(0.72 0.15 230)" radius={[4, 4, 0, 0]} name="P50" />
            <Bar dataKey="p95" fill="oklch(0.75 0.15 55)" radius={[4, 4, 0, 0]} name="P95" />
            <Bar dataKey="p99" fill="oklch(0.65 0.20 25)" radius={[4, 4, 0, 0]} name="P99" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
