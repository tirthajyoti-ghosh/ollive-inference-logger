"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProviderBreakdown as PB } from "@/lib/api";

const COLORS = [
  "oklch(0.72 0.15 230)",
  "oklch(0.70 0.17 160)",
  "oklch(0.70 0.15 290)",
  "oklch(0.75 0.15 55)",
  "oklch(0.65 0.20 25)",
];

interface ProviderBreakdownProps {
  data: PB[];
  loading?: boolean;
}

export function ProviderBreakdownChart({ data, loading }: ProviderBreakdownProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.provider,
    value: d.count,
  }));

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-4">Provider Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="oklch(0.17 0.015 260)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.17 0.015 260)",
                border: "1px solid oklch(0.28 0.015 260)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
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
