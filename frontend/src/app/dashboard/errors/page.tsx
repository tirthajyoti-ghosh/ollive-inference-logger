"use client";

import { useSearchParams } from "next/navigation";
import { useErrors } from "@/hooks/use-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  ErrorRateChart,
  ErrorBreakdownChart,
} from "@/components/dashboard/error-chart";
import { AlertTriangle, XCircle, ShieldAlert, Clock } from "lucide-react";
import { formatTimestamp } from "@/lib/utils";

function codeBadgeClass(status: string): string {
  const code = parseInt(status, 10);
  if (code === 429) return "badge badge-warn";
  if (code >= 500) return "badge badge-err";
  if (code >= 400) return "badge badge-warn";
  return "badge badge-neutral";
}

export default function ErrorsPage() {
  const searchParams = useSearchParams();
  const hours = Number(searchParams.get("hours") ?? 24);
  const { data, loading } = useErrors({ hours, refreshInterval: 30_000 });

  /* Derive KPI values */
  const errorRate = data?.error_rate ?? 0;
  const failedTotal = (data?.breakdown ?? []).reduce((s, b) => s + b.count, 0);
  const topError = (data?.breakdown ?? []).sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Error Rate"
          value={data ? `${errorRate.toFixed(2)}%` : "-"}
          icon={AlertTriangle}
          iconBg="var(--err-soft)"
          iconColor="oklch(0.4 0.1 25)"
          loading={loading}
        />
        <KpiCard
          label="Failed Requests"
          value={data ? failedTotal.toLocaleString() : "-"}
          icon={XCircle}
          iconBg="var(--err-soft)"
          iconColor="oklch(0.4 0.1 25)"
          loading={loading}
        />
        <KpiCard
          label="Top Error"
          value={topError ? topError.error_type : "-"}
          icon={ShieldAlert}
          iconBg="var(--warn-soft)"
          iconColor="oklch(0.38 0.08 60)"
          loading={loading}
        />
        <KpiCard
          label="MTTR"
          value="-"
          unit="min"
          icon={Clock}
          iconBg="var(--info-soft)"
          iconColor="oklch(0.38 0.08 235)"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <ErrorRateChart
            data={data?.error_timeseries ?? []}
            loading={loading}
          />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <ErrorBreakdownChart
            data={data?.breakdown ?? []}
            loading={loading}
          />
        </div>
      </div>

      {/* Recent errors table */}
      <div className="card-lg p-6">
        <h3 className="font-semibold mb-4" style={{ fontSize: 13.5, color: "var(--ink)" }}>
          Recent Errors
        </h3>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 w-full rounded bg-[var(--bg-2)] animate-pulse" />
            ))}
          </div>
        ) : !data?.recent_errors?.length ? (
          <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", textAlign: "center", padding: "24px 0" }}>
            No errors in this time range
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th
                    className="text-left font-medium py-2 pr-4"
                    style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    Code
                  </th>
                  <th
                    className="text-left font-medium py-2 pr-4"
                    style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    Message
                  </th>
                  <th
                    className="text-left font-medium py-2 pr-4"
                    style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    Model
                  </th>
                  <th
                    className="text-right font-medium py-2"
                    style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent_errors.map((err) => (
                  <tr key={err.id} style={{ borderBottom: "1px solid var(--bg-2)" }}>
                    <td className="py-2.5 pr-4">
                      <span className={codeBadgeClass(err.status)}>
                        {err.error_type || err.status}
                      </span>
                    </td>
                    <td
                      className="py-2.5 pr-4 max-w-xs truncate"
                      style={{ fontSize: 12.5, color: "var(--ink-2)" }}
                    >
                      {err.error_message || "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="badge badge-neutral font-mono">
                        {err.model}
                      </span>
                    </td>
                    <td
                      className="py-2.5 text-right whitespace-nowrap font-mono"
                      style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                    >
                      {formatTimestamp(err.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
