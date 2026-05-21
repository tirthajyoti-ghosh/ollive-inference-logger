"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDashboardOverview,
  getDashboardLatency,
  getDashboardThroughput,
  getDashboardErrors,
  type DashboardOverview,
  type DashboardLatency,
  type DashboardThroughput,
  type DashboardErrors,
} from "@/lib/api";

interface UseDashboardOptions {
  hours: number;
  refreshInterval?: number; // ms, default 30000
}

interface DashboardState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useDashboardFetch<T>(
  fetcher: (hours: number) => Promise<T>,
  { hours, refreshInterval = 30_000 }: UseDashboardOptions
): DashboardState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetcher(hours);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [fetcher, hours]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refresh: fetchData };
}

export function useOverview(opts: UseDashboardOptions) {
  return useDashboardFetch<DashboardOverview>(getDashboardOverview, opts);
}

export function useLatency(opts: UseDashboardOptions) {
  return useDashboardFetch<DashboardLatency>(getDashboardLatency, opts);
}

export function useThroughput(opts: UseDashboardOptions) {
  return useDashboardFetch<DashboardThroughput>(getDashboardThroughput, opts);
}

export function useErrors(opts: UseDashboardOptions) {
  return useDashboardFetch<DashboardErrors>(getDashboardErrors, opts);
}
