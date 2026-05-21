"use client";

import { useState } from "react";
import { useLatency } from "@/hooks/use-dashboard";
import {
  LatencyTimeseriesChart,
  LatencyByModelChart,
} from "@/components/dashboard/latency-chart";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import { formatLatency } from "@/lib/utils";

export default function LatencyPage() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useLatency({ hours, refreshInterval: 30_000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <TimeRangeSelector hours={hours} onChange={setHours} />
      </div>

      {/* Overall stats */}
      {data?.overall && (
        <div className="grid grid-cols-4 gap-4 animate-fade-up">
          {[
            { label: "P50", value: data.overall.p50, color: "text-primary" },
            { label: "P95", value: data.overall.p95, color: "text-sky-400" },
            { label: "P99", value: data.overall.p99, color: "text-rose-400" },
            { label: "Average", value: data.overall.avg, color: "text-foreground" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-5 text-center">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              <p className={`text-xl font-bold font-mono metric-value mt-2 ${stat.color}`}>
                {formatLatency(stat.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      <LatencyTimeseriesChart
        data={data?.timeseries ?? []}
        loading={loading}
      />

      <LatencyByModelChart data={data?.by_provider ?? []} loading={loading} />
    </div>
  );
}
