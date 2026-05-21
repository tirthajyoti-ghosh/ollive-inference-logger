"use client";

import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint, ErrorBreakdown } from "@/lib/api";

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

const ERROR_COLORS = [
  "oklch(0.65 0.20 25)",
  "oklch(0.75 0.15 55)",
  "oklch(0.70 0.15 290)",
  "oklch(0.72 0.15 230)",
  "oklch(0.70 0.17 160)",
];

interface ErrorRateChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function ErrorRateChart({ data, loading }: ErrorRateChartProps) {
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
      <h3 className="text-sm font-medium mb-4">Error Rate Over Time</h3>
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
              tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={formatTick}
              formatter={(value) => [`${(Number(value) * 100).toFixed(2)}%`, "Error Rate"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="oklch(0.65 0.20 25)"
              strokeWidth={2}
              dot={false}
              name="Error Rate"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface ErrorBreakdownChartProps {
  data: ErrorBreakdown[];
  loading?: boolean;
}

export function ErrorBreakdownChart({ data, loading }: ErrorBreakdownChartProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.type,
    value: d.count,
  }));

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Error Type Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={ERROR_COLORS[index % ERROR_COLORS.length]}
                  stroke="oklch(0.17 0.015 260)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value: string) => (
                <span style={{ color: "oklch(0.85 0.005 260)" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
