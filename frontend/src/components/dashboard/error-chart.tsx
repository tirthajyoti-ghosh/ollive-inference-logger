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
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint, ErrorBreakdown } from "@/lib/api";

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

const ERROR_COLORS = [
  "#fb7185",
  "#f59e0b",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
];

interface ErrorRateChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function ErrorRateChart({ data, loading }: ErrorRateChartProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-4 w-40 mb-5 bg-white/5" />
        <Skeleton className="h-64 w-full rounded-lg bg-white/5" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Error Rate Over Time</h3>
      <div className="h-64">
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
              stroke="#fb7185"
              strokeWidth={2}
              dot={false}
              activeDot={activeDot}
              name="Error Rate"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-4 w-40 mb-5 bg-white/5" />
        <Skeleton className="h-64 w-full rounded-lg bg-white/5" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.type,
    value: d.count,
  }));

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Error Type Breakdown</h3>
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
                  stroke="rgba(12,12,17,0.9)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value: string) => (
                <span style={{ color: "rgba(255,255,255,0.7)" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
