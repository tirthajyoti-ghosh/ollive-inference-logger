"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint } from "@/lib/api";

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

interface RPMChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function RPMChart({ data, loading }: RPMChartProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Requests per Minute</h3>
      <div className="h-64">
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
            />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={formatTick} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="oklch(0.72 0.15 230)"
              strokeWidth={2}
              dot={false}
              name="RPM"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface TokenChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function TokenConsumptionChart({ data, loading }: TokenChartProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Token Consumption</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="promptGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.15 230)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.72 0.15 230)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.70 0.17 160)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.70 0.17 160)" stopOpacity={0} />
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
            <Tooltip contentStyle={tooltipStyle} labelFormatter={formatTick} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Area
              type="monotone"
              dataKey="prompt_tokens"
              stackId="1"
              stroke="oklch(0.72 0.15 230)"
              fill="url(#promptGrad)"
              name="Prompt"
            />
            <Area
              type="monotone"
              dataKey="completion_tokens"
              stackId="1"
              stroke="oklch(0.70 0.17 160)"
              fill="url(#completionGrad)"
              name="Completion"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface CostChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function CostChart({ data, loading }: CostChartProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Cost Over Time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.70 0.15 290)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.70 0.15 290)" stopOpacity={0} />
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
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={formatTick}
              formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="oklch(0.70 0.15 290)"
              strokeWidth={2}
              fill="url(#costGrad)"
              name="Cost (USD)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
