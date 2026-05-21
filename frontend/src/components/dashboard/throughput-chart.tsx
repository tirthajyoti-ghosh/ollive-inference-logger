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
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeseriesPoint } from "@/lib/api";

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

interface RPMChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function RPMChart({ data, loading }: RPMChartProps) {
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
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Requests per Minute</h3>
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
            />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={formatTick} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={activeDot}
              name="RPM"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface TokenChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function TokenConsumptionChart({ data, loading }: TokenChartProps) {
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
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Token Consumption</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="promptGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={formatTick} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Area
              type="monotone"
              dataKey="prompt_tokens"
              stackId="1"
              stroke="#f59e0b"
              fill="url(#promptGrad)"
              name="Prompt"
            />
            <Area
              type="monotone"
              dataKey="completion_tokens"
              stackId="1"
              stroke="#38bdf8"
              fill="url(#completionGrad)"
              name="Completion"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface CostChartProps {
  data: TimeseriesPoint[];
  loading?: boolean;
}

export function CostChart({ data, loading }: CostChartProps) {
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
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Cost Over Time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#costGrad)"
              name="Cost (USD)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
