import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)


class MaterializedViewRefresher:
    """Periodically refreshes the inference_stats_hourly materialized view."""

    def __init__(self, db_engine: AsyncEngine, interval_seconds: int = 300) -> None:
        self._engine = db_engine
        self._interval = interval_seconds

    async def run(self) -> None:
        """Loop forever, refreshing the materialized view on the configured interval."""
        logger.info(
            "Materialized view refresher started (interval=%ds)", self._interval
        )
        while True:
            try:
                async with self._engine.begin() as conn:
                    await conn.execute(
                        text("REFRESH MATERIALIZED VIEW CONCURRENTLY inference_stats_hourly")
                    )
                logger.info("Refreshed materialized view inference_stats_hourly")
            except asyncio.CancelledError:
                logger.info("Materialized view refresher cancelled")
                raise
            except Exception:
                logger.exception("Failed to refresh materialized view")

            await asyncio.sleep(self._interval)
