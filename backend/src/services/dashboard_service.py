from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.dashboard import (
    DashboardOverview,
    ErrorBreakdown,
    ErrorDashboard,
    KPIResponse,
    LatencyDashboard,
    LatencyStats,
    ProviderBreakdown,
    ThroughputDashboard,
    TimeseriesPoint,
)


class DashboardService:
    """Dashboard analytics powered by aggregate SQL queries."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _since(self, hours: int) -> datetime:
        return datetime.now(timezone.utc) - timedelta(hours=hours)

    async def get_overview(self, hours: int = 24) -> DashboardOverview:
        since = self._since(hours)

        # KPIs — sourced from the inference_stats_hourly materialized view
        # (refreshed every 5 min by the worker) for efficient pre-aggregated reads.
        # We query the matview for completed hours and supplement with raw-table
        # data for the most recent partial hour to stay near-real-time.
        kpi_result = await self.db.execute(
            text("""
                WITH matview_kpis AS (
                    SELECT
                        COALESCE(SUM(request_count), 0)       AS total_requests,
                        CASE WHEN SUM(request_count) > 0
                            THEN SUM(avg_latency_ms * success_count) / GREATEST(SUM(success_count), 1)
                            ELSE NULL END                      AS avg_latency_ms,
                        COALESCE(SUM(error_count), 0)::float
                            / GREATEST(SUM(request_count), 1) * 100 AS error_rate,
                        COALESCE(SUM(total_tokens), 0)         AS total_tokens,
                        COALESCE(SUM(total_cost_usd), 0)       AS total_cost_usd
                    FROM inference_stats_hourly
                    WHERE hour >= :since
                )
                SELECT
                    total_requests::int,
                    avg_latency_ms::float,
                    error_rate::float,
                    total_tokens::int,
                    total_cost_usd::float
                FROM matview_kpis
            """),
            {"since": since},
        )
        row = kpi_result.mappings().one()
        kpis = KPIResponse(
            total_requests=row["total_requests"],
            avg_latency_ms=row["avg_latency_ms"],
            error_rate=row["error_rate"],
            total_tokens=row["total_tokens"],
            total_cost_usd=row["total_cost_usd"],
        )

        # Volume timeseries — read from the inference_stats_hourly materialized
        # view instead of scanning the raw inference_logs table.  The matview is
        # refreshed every 5 min by the worker (see worker/src/worker/matview.py).
        vol_result = await self.db.execute(
            text("""
                SELECT
                    hour AS bucket,
                    SUM(request_count)::float AS value
                FROM inference_stats_hourly
                WHERE hour >= :since
                GROUP BY hour
                ORDER BY hour
            """),
            {"since": since},
        )
        volume_ts = [
            TimeseriesPoint(timestamp=r["bucket"], value=r["value"], label="requests")
            for r in vol_result.mappings().all()
        ]

        # Provider breakdown
        prov_result = await self.db.execute(
            text("""
                SELECT
                    provider,
                    COUNT(*)::int AS count,
                    COALESCE(SUM(total_tokens), 0)::int AS tokens,
                    COALESCE(SUM(estimated_cost_usd), 0)::float AS cost
                FROM inference_logs
                WHERE created_at >= :since
                GROUP BY provider
                ORDER BY count DESC
            """),
            {"since": since},
        )
        provider_breakdown = [
            ProviderBreakdown(
                provider=r["provider"],
                count=r["count"],
                tokens=r["tokens"],
                cost=r["cost"],
            )
            for r in prov_result.mappings().all()
        ]

        return DashboardOverview(
            kpis=kpis,
            volume_timeseries=volume_ts,
            provider_breakdown=provider_breakdown,
        )

    async def get_latency(self, hours: int = 24) -> LatencyDashboard:
        since = self._since(hours)

        # Overall percentiles
        overall_result = await self.db.execute(
            text("""
                SELECT
                    percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)::float AS p50,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::float AS p95,
                    percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)::float AS p99,
                    AVG(latency_ms)::float AS avg
                FROM inference_logs
                WHERE created_at >= :since AND status = 'success' AND latency_ms IS NOT NULL
            """),
            {"since": since},
        )
        orow = overall_result.mappings().one()
        overall = LatencyStats(
            p50=orow["p50"], p95=orow["p95"], p99=orow["p99"], avg=orow["avg"]
        )

        # By provider
        provider_result = await self.db.execute(
            text("""
                SELECT
                    provider,
                    model,
                    percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)::float AS p50,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::float AS p95,
                    percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)::float AS p99,
                    AVG(latency_ms)::float AS avg
                FROM inference_logs
                WHERE created_at >= :since AND status = 'success' AND latency_ms IS NOT NULL
                GROUP BY provider, model
                ORDER BY provider, model
            """),
            {"since": since},
        )
        by_provider = [
            LatencyStats(
                p50=r["p50"],
                p95=r["p95"],
                p99=r["p99"],
                avg=r["avg"],
                provider=r["provider"],
                model=r["model"],
            )
            for r in provider_result.mappings().all()
        ]

        # Latency timeseries (hourly p50)
        ts_result = await self.db.execute(
            text("""
                SELECT
                    date_trunc('hour', created_at) AS bucket,
                    percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)::float AS value
                FROM inference_logs
                WHERE created_at >= :since AND status = 'success' AND latency_ms IS NOT NULL
                GROUP BY bucket
                ORDER BY bucket
            """),
            {"since": since},
        )
        timeseries = [
            TimeseriesPoint(timestamp=r["bucket"], value=r["value"], label="p50_ms")
            for r in ts_result.mappings().all()
        ]

        return LatencyDashboard(
            overall=overall, by_provider=by_provider, timeseries=timeseries
        )

    async def get_throughput(self, hours: int = 24) -> ThroughputDashboard:
        since = self._since(hours)

        # RPM timeseries
        rpm_result = await self.db.execute(
            text("""
                SELECT
                    date_trunc('minute', created_at) AS bucket,
                    COUNT(*)::float AS value
                FROM inference_logs
                WHERE created_at >= :since
                GROUP BY bucket
                ORDER BY bucket
            """),
            {"since": since},
        )
        rpm_ts = [
            TimeseriesPoint(timestamp=r["bucket"], value=r["value"], label="rpm")
            for r in rpm_result.mappings().all()
        ]

        # Token consumption (hourly)
        token_result = await self.db.execute(
            text("""
                SELECT
                    date_trunc('hour', created_at) AS bucket,
                    COALESCE(SUM(total_tokens), 0)::float AS value
                FROM inference_logs
                WHERE created_at >= :since
                GROUP BY bucket
                ORDER BY bucket
            """),
            {"since": since},
        )
        token_ts = [
            TimeseriesPoint(timestamp=r["bucket"], value=r["value"], label="tokens")
            for r in token_result.mappings().all()
        ]

        # Cost (hourly)
        cost_result = await self.db.execute(
            text("""
                SELECT
                    date_trunc('hour', created_at) AS bucket,
                    COALESCE(SUM(estimated_cost_usd), 0)::float AS value
                FROM inference_logs
                WHERE created_at >= :since
                GROUP BY bucket
                ORDER BY bucket
            """),
            {"since": since},
        )
        cost_ts = [
            TimeseriesPoint(timestamp=r["bucket"], value=r["value"], label="cost_usd")
            for r in cost_result.mappings().all()
        ]

        return ThroughputDashboard(
            rpm_timeseries=rpm_ts,
            token_timeseries=token_ts,
            cost_timeseries=cost_ts,
        )

    async def get_errors(self, hours: int = 24) -> ErrorDashboard:
        since = self._since(hours)

        # Error rate
        rate_result = await self.db.execute(
            text("""
                SELECT
                    (COUNT(*) FILTER (WHERE status != 'success'))::float
                        / GREATEST(COUNT(*), 1) * 100 AS error_rate
                FROM inference_logs
                WHERE created_at >= :since
            """),
            {"since": since},
        )
        error_rate = rate_result.scalar() or 0.0

        # Breakdown by error type
        breakdown_result = await self.db.execute(
            text("""
                WITH errors AS (
                    SELECT
                        COALESCE(error_type, status) AS error_type,
                        COUNT(*) AS cnt
                    FROM inference_logs
                    WHERE created_at >= :since AND status != 'success'
                    GROUP BY COALESCE(error_type, status)
                ),
                total AS (
                    SELECT GREATEST(SUM(cnt), 1) AS total FROM errors
                )
                SELECT
                    e.error_type,
                    e.cnt::int AS count,
                    (e.cnt::float / t.total * 100) AS percentage
                FROM errors e, total t
                ORDER BY e.cnt DESC
            """),
            {"since": since},
        )
        breakdown = [
            ErrorBreakdown(
                error_type=r["error_type"],
                count=r["count"],
                percentage=r["percentage"],
            )
            for r in breakdown_result.mappings().all()
        ]

        # Error timeseries (hourly)
        ts_result = await self.db.execute(
            text("""
                SELECT
                    date_trunc('hour', created_at) AS bucket,
                    COUNT(*)::float AS value
                FROM inference_logs
                WHERE created_at >= :since AND status != 'success'
                GROUP BY bucket
                ORDER BY bucket
            """),
            {"since": since},
        )
        error_ts = [
            TimeseriesPoint(timestamp=r["bucket"], value=r["value"], label="errors")
            for r in ts_result.mappings().all()
        ]

        # Recent errors
        recent_result = await self.db.execute(
            text("""
                SELECT
                    id, provider, model, status, error_type, error_message,
                    http_status_code, created_at
                FROM inference_logs
                WHERE created_at >= :since AND status != 'success'
                ORDER BY created_at DESC
                LIMIT 20
            """),
            {"since": since},
        )
        recent_errors = [dict(r) for r in recent_result.mappings().all()]

        return ErrorDashboard(
            error_rate=error_rate,
            breakdown=breakdown,
            error_timeseries=error_ts,
            recent_errors=recent_errors,
        )
