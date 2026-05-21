import asyncio
import logging
import os
import signal
import socket

import redis.asyncio as redis

from src.worker.config import settings
from src.worker.consumer import InferenceLogConsumer
from src.worker.database import async_session_factory, engine
from src.worker.health import run_health_server
from src.worker.matview import MaterializedViewRefresher
from src.worker.processor import ProcessingPipeline
from src.worker.redactor import DeepRedactor, SimpleRedactor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    consumer_name = os.environ.get("CONSUMER_NAME", socket.gethostname())
    logger.info("Starting inference log worker (consumer=%s)", consumer_name)

    # Initialize Redis client
    redis_client = redis.from_url(
        settings.redis_url,
        decode_responses=False,
    )

    # Initialize PII redactor
    if settings.pii_redaction_enabled:
        redactor = DeepRedactor()
    else:
        redactor = SimpleRedactor()

    # Initialize processing pipeline
    pipeline = ProcessingPipeline(
        db_session_factory=async_session_factory,
        redactor=redactor,
    )

    # Initialize consumer
    consumer = InferenceLogConsumer(
        redis_client=redis_client,
        pipeline=pipeline,
        settings=settings,
    )

    # Initialize materialized view refresher
    matview_refresher = MaterializedViewRefresher(
        db_engine=engine,
        interval_seconds=settings.matview_refresh_interval_s,
    )

    # Run all tasks concurrently
    tasks = [
        asyncio.create_task(consumer.run(consumer_name), name="consumer"),
        asyncio.create_task(consumer.claim_stale(consumer_name), name="claim_stale"),
        asyncio.create_task(run_health_server(), name="health"),
        asyncio.create_task(matview_refresher.run(), name="matview_refresher"),
    ]

    # Set up shutdown handler
    shutdown_event = asyncio.Event()

    def handle_shutdown() -> None:
        logger.info("Shutdown signal received")
        shutdown_event.set()
        consumer._shutdown()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_shutdown)

    try:
        # Wait until shutdown is triggered or a task fails unexpectedly
        done, pending = await asyncio.wait(
            tasks,
            return_when=asyncio.FIRST_COMPLETED,
        )

        # If shutdown was triggered, cancel remaining tasks
        for task in pending:
            task.cancel()

        # Wait for clean cancellation
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

        # Check for unexpected failures
        for task in done:
            if task.exception() and not shutdown_event.is_set():
                logger.error(
                    "Task '%s' failed unexpectedly: %s",
                    task.get_name(),
                    task.exception(),
                )

    finally:
        # Cleanup
        await redis_client.aclose()
        await engine.dispose()
        logger.info("Worker shut down cleanly")


if __name__ == "__main__":
    asyncio.run(main())
