"use client";

import { useSearchParams } from "next/navigation";
import { useLatency } from "@/hooks/use-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  LatencyTimeseriesChart,
  LatencyByModelChart,
} from "@/components/dashboard/latency-chart";
import { Timer } from "lucide-react";
import { formatLatency } from "@/lib/utils";

export default function LatencyPage() {
  const searchParams = useSearchParams();
  const hours = Number(searchParams.get("hours") ?? 24);
  const { data, loading } = useLatency({ hours, refreshInterval: 30_000 });

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="P50 Latency"
          value={data?.overall ? formatLatency(data.overall.p50) : "-"}
          unit="ms"
          icon={Timer}
          iconBg="var(--olive-soft)"
          iconColor="var(--olive-fg)"
          loading={loading}
        />
        <KpiCard
          label="P95 Latency"
          value={data?.overall ? formatLatency(data.overall.p95) : "-"}
          unit="ms"
          icon={Timer}
          iconBg="var(--info-soft)"
          iconColor="oklch(0.38 0.08 235)"
          loading={loading}
        />
        <KpiCard
          label="P99 Latency"
          value={data?.overall ? formatLatency(data.overall.p99) : "-"}
          unit="ms"
          icon={Timer}
          iconBg="var(--err-soft)"
          iconColor="oklch(0.4 0.1 25)"
          loading={loading}
        />
      </div>

      <LatencyTimeseriesChart
        data={data?.timeseries ?? []}
        loading={loading}
      />

      <LatencyByModelChart data={data?.by_provider ?? []} loading={loading} />
    </div>
  );
}
