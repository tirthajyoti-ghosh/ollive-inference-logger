"use client";

import { useState } from "react";
import { useThroughput } from "@/hooks/use-dashboard";
import {
  RPMChart,
  TokenConsumptionChart,
  CostChart,
} from "@/components/dashboard/throughput-chart";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";

export default function ThroughputPage() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useThroughput({ hours, refreshInterval: 30_000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <TimeRangeSelector hours={hours} onChange={setHours} />
      </div>

      <RPMChart data={data?.rpm_timeseries ?? []} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenConsumptionChart
          data={data?.token_timeseries ?? []}
          loading={loading}
        />
        <CostChart data={data?.cost_timeseries ?? []} loading={loading} />
      </div>
    </div>
  );
}
