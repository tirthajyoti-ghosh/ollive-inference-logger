"use client";

import { useSearchParams } from "next/navigation";
import { useThroughput } from "@/hooks/use-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  RPMChart,
  TokenConsumptionChart,
  CostChart,
} from "@/components/dashboard/throughput-chart";
import { Gauge, ArrowUpDown, ArrowDownUp, Coins } from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/utils";

export default function ThroughputPage() {
  const searchParams = useSearchParams();
  const hours = Number(searchParams.get("hours") ?? 24);
  const { data, loading } = useThroughput({ hours, refreshInterval: 30_000 });

  /* Derive quick KPI values */
  const rpmData = data?.rpm_timeseries ?? [];
  const peakRpm = rpmData.length
    ? Math.max(...rpmData.map((p) => p.value))
    : 0;

  const tokenData = data?.token_timeseries ?? [];
  const totalInput = tokenData.reduce(
    (s, p) => s + ((p as any).prompt_tokens ?? 0),
    0
  );
  const totalOutput = tokenData.reduce(
    (s, p) => s + ((p as any).completion_tokens ?? 0),
    0
  );

  const costData = data?.cost_timeseries ?? [];
  const totalCost = costData.reduce((s, p) => s + (p.value ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Peak RPM"
          value={data ? formatNumber(peakRpm) : "-"}
          icon={Gauge}
          iconBg="var(--olive-soft)"
          iconColor="var(--olive-fg)"
          sparkData={rpmData.map((p) => p.value)}
          sparkColor="var(--olive)"
          loading={loading}
        />
        <KpiCard
          label="Input Tokens"
          value={data ? formatNumber(totalInput) : "-"}
          icon={ArrowUpDown}
          iconBg="var(--info-soft)"
          iconColor="oklch(0.38 0.08 235)"
          loading={loading}
        />
        <KpiCard
          label="Output Tokens"
          value={data ? formatNumber(totalOutput) : "-"}
          icon={ArrowDownUp}
          iconBg="var(--olive-soft)"
          iconColor="var(--olive-fg)"
          loading={loading}
        />
        <KpiCard
          label="Total Cost"
          value={data ? formatCurrency(totalCost) : "-"}
          icon={Coins}
          iconBg="var(--warn-soft)"
          iconColor="oklch(0.38 0.08 60)"
          sparkData={costData.map((p) => p.value)}
          sparkColor="oklch(0.72 0.12 75)"
          loading={loading}
        />
      </div>

      {/* RPM full width */}
      <RPMChart data={data?.rpm_timeseries ?? []} loading={loading} />

      {/* Token + Cost side by side */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <TokenConsumptionChart
            data={data?.token_timeseries ?? []}
            loading={loading}
          />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <CostChart data={data?.cost_timeseries ?? []} loading={loading} />
        </div>
      </div>
    </div>
  );
}
