"use client";

import { useSearchParams } from "next/navigation";
import { useOverview } from "@/hooks/use-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { ProviderBreakdownChart } from "@/components/dashboard/provider-breakdown";
import {
  Activity,
  Clock,
  AlertTriangle,
  Coins,
  Hash,
} from "lucide-react";
import { formatNumber, formatLatency, formatCurrency } from "@/lib/utils";

export default function DashboardOverviewPage() {
  const searchParams = useSearchParams();
  const hours = Number(searchParams.get("hours") ?? 24);
  const { data, loading } = useOverview({ hours, refreshInterval: 30_000 });

  /* Build spark data from volume timeseries — only used for Total Requests
     since the API only provides one timeseries; other KPIs don't have
     per-metric sparkline data so we omit them rather than show misleading
     identical sparklines. */
  const sparkVolume = (data?.volume_timeseries ?? []).map((p) => p.value);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Requests"
          value={data ? formatNumber(data.kpis.total_requests) : "-"}
          icon={Activity}
          iconBg="var(--olive-soft)"
          iconColor="var(--olive-fg)"
          sparkData={sparkVolume}
          sparkColor="var(--olive)"
          loading={loading}
        />
        <KpiCard
          label="Avg Latency"
          value={data ? formatLatency(data.kpis.avg_latency_ms) : "-"}
          unit="ms"
          icon={Clock}
          iconBg="var(--info-soft)"
          iconColor="oklch(0.38 0.08 235)"
          loading={loading}
        />
        <KpiCard
          label="Error Rate"
          value={data ? `${data.kpis.error_rate.toFixed(2)}%` : "-"}
          icon={AlertTriangle}
          iconBg="var(--err-soft)"
          iconColor="oklch(0.4 0.1 25)"
          loading={loading}
        />
        <KpiCard
          label="Total Tokens"
          value={data ? formatNumber(data.kpis.total_tokens) : "-"}
          icon={Hash}
          iconBg="var(--olive-soft)"
          iconColor="var(--olive-fg)"
          loading={loading}
        />
        <KpiCard
          label="Est. Cost"
          value={data ? formatCurrency(data.kpis.total_cost_usd) : "-"}
          icon={Coins}
          iconBg="var(--warn-soft)"
          iconColor="oklch(0.38 0.08 60)"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <VolumeChart
            data={data?.volume_timeseries ?? []}
            loading={loading}
          />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <ProviderBreakdownChart
            data={data?.provider_breakdown ?? []}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
