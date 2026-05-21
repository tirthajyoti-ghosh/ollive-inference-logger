from datetime import datetime

from pydantic import BaseModel


class KPIResponse(BaseModel):
    total_requests: int
    avg_latency_ms: float | None
    error_rate: float
    total_tokens: int
    total_cost_usd: float


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    value: float
    label: str | None = None


class LatencyStats(BaseModel):
    p50: float | None
    p95: float | None
    p99: float | None
    avg: float | None
    provider: str | None = None
    model: str | None = None


class ErrorBreakdown(BaseModel):
    error_type: str
    count: int
    percentage: float


class ProviderBreakdown(BaseModel):
    provider: str
    count: int
    tokens: int
    cost: float


class DashboardOverview(BaseModel):
    kpis: KPIResponse
    volume_timeseries: list[TimeseriesPoint]
    provider_breakdown: list[ProviderBreakdown]


class LatencyDashboard(BaseModel):
    overall: LatencyStats
    by_provider: list[LatencyStats]
    timeseries: list[TimeseriesPoint]


class ThroughputDashboard(BaseModel):
    rpm_timeseries: list[TimeseriesPoint]
    token_timeseries: list[TimeseriesPoint]
    cost_timeseries: list[TimeseriesPoint]


class ErrorDashboard(BaseModel):
    error_rate: float
    breakdown: list[ErrorBreakdown]
    error_timeseries: list[TimeseriesPoint]
    recent_errors: list[dict]
