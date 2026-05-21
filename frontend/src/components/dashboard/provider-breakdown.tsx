"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProviderBreakdown as PB } from "@/lib/api";

const COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185"];

interface ProviderBreakdownProps {
  data: PB[];
  loading?: boolean;
}

export function ProviderBreakdownChart({ data, loading }: ProviderBreakdownProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-4 w-32 mb-4 bg-white/5" />
        <Skeleton className="h-64 w-full rounded-xl bg-white/5" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.provider.charAt(0).toUpperCase() + d.provider.slice(1),
    value: d.count,
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-[13px] font-semibold mb-5 text-foreground/80">Provider Breakdown</h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(12,12,17,0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 8px 32px -8px rgba(0,0,0,0.6)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Custom legend */}
      <div className="flex flex-col gap-2.5 mt-3">
        {chartData.map((entry, i) => (
          <div key={entry.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-[12px] text-foreground/70 font-medium">{entry.name}</span>
            </div>
            <span className="text-[12px] font-mono font-semibold text-foreground/90">
              {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
