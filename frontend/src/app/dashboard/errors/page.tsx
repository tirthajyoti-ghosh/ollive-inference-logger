"use client";

import { useState } from "react";
import { useErrors } from "@/hooks/use-dashboard";
import {
  ErrorRateChart,
  ErrorBreakdownChart,
} from "@/components/dashboard/error-chart";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";

export default function ErrorsPage() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useErrors({ hours, refreshInterval: 30_000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <TimeRangeSelector hours={hours} onChange={setHours} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorRateChart
          data={data?.error_timeseries ?? []}
          loading={loading}
        />
        <ErrorBreakdownChart
          data={data?.breakdown ?? []}
          loading={loading}
        />
      </div>

      {/* Recent errors table */}
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-4">Recent Errors</h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.recent_errors?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No errors in this time range
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2 pr-4">Message</th>
                  <th className="text-left py-2 pr-4">Model</th>
                  <th className="text-right py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_errors.map((err) => (
                  <tr key={err.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20"
                      >
                        {err.error_type || err.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 max-w-xs truncate text-xs">
                      {err.error_message || "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="secondary" className="text-[10px]">
                        {err.model}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                      {formatTimestamp(err.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
