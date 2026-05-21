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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint } from "@/lib/api";

interface VolumeChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

function formatTick(timestamp: unknown) {
  const d = new Date(String(timestamp));
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function VolumeChart({ data, loading }: VolumeChartProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Request Volume</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.15 230)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.72 0.15 230)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.17 0.015 260)",
                border: "1px solid oklch(0.28 0.015 260)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={formatTick}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="oklch(0.72 0.15 230)"
              strokeWidth={2}
              fill="url(#volumeGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
