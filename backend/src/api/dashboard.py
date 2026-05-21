from fastapi import APIRouter, Depends, Query

from src.deps import get_dashboard_service
from src.schemas.dashboard import (
    DashboardOverview,
    ErrorDashboard,
    LatencyDashboard,
    ThroughputDashboard,
)
from src.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
async def dashboard_overview(
    hours: int = Query(24, ge=1, le=720),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_overview(hours=hours)


@router.get("/latency", response_model=LatencyDashboard)
async def dashboard_latency(
    hours: int = Query(24, ge=1, le=720),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_latency(hours=hours)


@router.get("/throughput", response_model=ThroughputDashboard)
async def dashboard_throughput(
    hours: int = Query(24, ge=1, le=720),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_throughput(hours=hours)


@router.get("/errors", response_model=ErrorDashboard)
async def dashboard_errors(
    hours: int = Query(24, ge=1, le=720),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_errors(hours=hours)
