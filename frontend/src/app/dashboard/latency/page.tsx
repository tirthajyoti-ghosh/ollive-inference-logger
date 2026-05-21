"use client";

import { useState } from "react";
import { useLatency } from "@/hooks/use-dashboard";
import {
  LatencyTimeseriesChart,
  LatencyByModelChart,
} from "@/components/dashboard/latency-chart";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import { Card } from "@/components/ui/card";
import { formatLatency } from "@/lib/utils";

export default function LatencyPage() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useLatency({ hours, refreshInterval: 30_000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <TimeRangeSelector hours={hours} onChange={setHours} />
      </div>

      {/* Percentile timeseries */}
      <LatencyTimeseriesChart
        data={data?.timeseries ?? []}
        loading={loading}
      />

      {/* By provider/model */}
      <LatencyByModelChart data={data?.by_provider ?? []} loading={loading} />

      {/* Overall stats */}
      {data?.overall && (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Overall Latency Percentiles</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">P50</p>
              <p className="text-lg font-semibold tabular-nums">{formatLatency(data.overall.p50)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">P95</p>
              <p className="text-lg font-semibold tabular-nums text-amber-400">{formatLatency(data.overall.p95)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">P99</p>
              <p className="text-lg font-semibold tabular-nums text-red-400">{formatLatency(data.overall.p99)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-semibold tabular-nums">{formatLatency(data.overall.avg)}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
