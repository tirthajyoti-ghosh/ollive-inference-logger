"use client";

import { useState } from "react";
import { useOverview } from "@/hooks/use-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { ProviderBreakdownChart } from "@/components/dashboard/provider-breakdown";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import {
  Activity,
  Clock,
  AlertTriangle,
  Coins,
  Hash,
} from "lucide-react";
import { formatNumber, formatLatency, formatCurrency } from "@/lib/utils";

export default function DashboardOverviewPage() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useOverview({ hours, refreshInterval: 30_000 });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end">
        <TimeRangeSelector hours={hours} onChange={setHours} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="stagger-1">
          <KpiCard
            label="Total Requests"
            value={data ? formatNumber(data.kpis.total_requests) : "-"}
            icon={Activity}
            iconColor="text-primary"
            glowColor="rgba(245,158,11,0.06)"
            loading={loading}
          />
        </div>
        <div className="stagger-2">
          <KpiCard
            label="Avg Latency"
            value={data ? formatLatency(data.kpis.avg_latency_ms) : "-"}
            icon={Clock}
            iconColor="text-sky-400"
            glowColor="rgba(56,189,248,0.05)"
            loading={loading}
          />
        </div>
        <div className="stagger-3">
          <KpiCard
            label="Error Rate"
            value={data ? `${data.kpis.error_rate.toFixed(2)}%` : "-"}
            icon={AlertTriangle}
            iconColor="text-rose-400"
            glowColor="rgba(244,63,94,0.04)"
            loading={loading}
          />
        </div>
        <div className="stagger-4">
          <KpiCard
            label="Total Tokens"
            value={data ? formatNumber(data.kpis.total_tokens) : "-"}
            icon={Hash}
            iconColor="text-emerald-400"
            glowColor="rgba(52,211,153,0.04)"
            loading={loading}
          />
        </div>
        <div className="stagger-5">
          <KpiCard
            label="Est. Cost"
            value={data ? formatCurrency(data.kpis.total_cost_usd) : "-"}
            icon={Coins}
            iconColor="text-violet-400"
            glowColor="rgba(167,139,250,0.04)"
            loading={loading}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-up stagger-6">
        <div className="lg:col-span-2">
          <VolumeChart
            data={data?.volume_timeseries ?? []}
            loading={loading}
          />
        </div>
        <ProviderBreakdownChart
          data={data?.provider_breakdown ?? []}
          loading={loading}
        />
      </div>
    </div>
  );
}
