"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/latency", label: "Latency" },
  { href: "/dashboard/throughput", label: "Throughput" },
  { href: "/dashboard/errors", label: "Errors" },
] as const;

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const hoursParam = searchParams.get("hours");
  const hours = hoursParam ? Number(hoursParam) : 24;

  const setHours = useCallback(
    (h: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("hours", String(h));
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, searchParams, router]
  );

  /* Auto-refresh timer */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        setRefreshKey((k) => k + 1);
      }, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  return (
    <div className="page-enter">
      {/* Header bar */}
      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-[1280px] mx-auto px-8 pt-7 pb-0">
          {/* Title row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1
                className="font-semibold tracking-tight"
                style={{ fontSize: 22, color: "var(--ink)" }}
              >
                Dashboard
              </h1>
              <p
                className="mt-1"
                style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}
              >
                Live observability across providers — every request, token, and millisecond.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Auto-refresh toggle */}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setAutoRefresh((p) => !p)}
              >
                <span
                  className={cn(
                    "inline-block w-2 h-2 rounded-full mr-1.5",
                    autoRefresh ? "pulse-ok" : ""
                  )}
                  style={{
                    background: autoRefresh ? "var(--ok)" : "var(--faint)",
                  }}
                />
                Auto
              </button>

              {/* Manual refresh */}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RefreshCw style={{ width: 13, height: 13 }} />
                Refresh
              </button>

              {/* Time range */}
              <TimeRangeSelector hours={hours} onChange={setHours} />
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex items-center gap-5" style={{ borderBottom: "none" }}>
            {TABS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={`${href}?hours=${hours}`}
                  className={cn("tab", active && "active")}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-[1280px] mx-auto px-8 py-7" key={refreshKey}>
        <Suspense>{children}</Suspense>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
