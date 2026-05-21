import asyncio
import json
import logging
import signal
from typing import Any

import redis.asyncio as redis

from src.worker.config import WorkerSettings
from src.worker.processor import ProcessingPipeline

logger = logging.getLogger(__name__)


class InferenceLogConsumer:
    """Redis Streams consumer for inference log ingestion."""

    def __init__(
        self,
        redis_client: redis.Redis,
        pipeline: ProcessingPipeline,
        settings: WorkerSettings,
    ) -> None:
        self._redis = redis_client
        self._pipeline = pipeline
        self._settings = settings
        self._stream = settings.stream_name
        self._group = settings.consumer_group
        self._running = False

    async def create_consumer_group(self) -> None:
        """Create the consumer group idempotently."""
        try:
            await self._redis.xgroup_create(
                name=self._stream,
                groupname=self._group,
                id="0",
                mkstream=True,
            )
            logger.info(
                "Created consumer group '%s' on stream '%s'",
                self._group,
                self._stream,
            )
        except redis.ResponseError as exc:
            if "BUSYGROUP" in str(exc):
                logger.debug("Consumer group '%s' already exists", self._group)
            else:
                raise

    async def run(self, consumer_name: str) -> None:
        """Main consumer loop: read, process, ACK, handle dead letters."""
        await self.create_consumer_group()
        self._running = True

        # Set up graceful shutdown
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self._shutdown)

        logger.info("Consumer '%s' starting on stream '%s'", consumer_name, self._stream)

        while self._running:
            try:
                # Read new messages from the stream
                response = await self._redis.xreadgroup(
                    groupname=self._group,
                    consumername=consumer_name,
                    streams={self._stream: ">"},
                    count=self._settings.batch_size,
                    block=self._settings.block_ms,
                )

                if not response:
                    continue

                # response format: [(stream_name, [(msg_id, fields), ...])]
                for _stream_name, messages in response:
                    if not messages:
                        continue

                    msg_ids: list[bytes] = []
                    parsed_batch: list[dict[str, Any]] = []
                    raw_entries: list[tuple[bytes, dict]] = []

                    for msg_id, fields in messages:
                        msg_ids.append(msg_id)
                        try:
                            # Messages are stored as {"data": json_string}
                            raw_data = fields.get(b"data") or fields.get("data")
                            if raw_data is None:
                                # Try to decode fields directly as the payload
                                decoded = {
                                    (k.decode() if isinstance(k, bytes) else k): (
                                        v.decode() if isinstance(v, bytes) else v
                                    )
                                    for k, v in fields.items()
                                }
                                parsed_batch.append(decoded)
                            else:
                                if isinstance(raw_data, bytes):
                                    raw_data = raw_data.decode()
                                parsed_batch.append(json.loads(raw_data))
                            raw_entries.append((msg_id, fields))
                        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                            logger.error(
                                "Failed to parse message %s: %s", msg_id, exc
                            )
                            raw_entries.append((msg_id, fields))
                            # Count parsing failures for dead-letter handling
                            await self._handle_failed_message(
                                msg_id, fields, str(exc)
                            )

                    if parsed_batch:
                        result = await self._pipeline.process_batch(parsed_batch)
                        logger.info(
                            "Batch processed: %d ok, %d failed",
                            result.processed,
                            result.failed,
                        )

                    # ACK all successfully read messages
                    if msg_ids:
                        await self._redis.xack(self._stream, self._group, *msg_ids)

            except asyncio.CancelledError:
                logger.info("Consumer '%s' cancelled, shutting down", consumer_name)
                break
            except Exception:
                logger.exception("Unexpected error in consumer loop")
                await asyncio.sleep(1)  # Back off on unexpected errors

        logger.info("Consumer '%s' stopped", consumer_name)

    async def _handle_failed_message(
        self, msg_id: bytes, fields: dict, error: str
    ) -> None:
        """Track retries; move to dead-letter stream after max_retries."""
        retry_key = f"retry:{self._stream}:{msg_id}"
        retries = await self._redis.incr(retry_key)
        await self._redis.expire(retry_key, 3600)  # 1 hour TTL on retry counter

        if retries > self._settings.max_retries:
            logger.warning(
                "Message %s exceeded max retries (%d), moving to dead-letter stream",
                msg_id,
                self._settings.max_retries,
            )
            # Serialize fields for dead-letter stream
            dead_letter_fields: dict[str, str] = {
                "original_id": msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id),
                "error": error,
                "retries": str(retries),
            }
            for k, v in fields.items():
                key = k.decode() if isinstance(k, bytes) else str(k)
                val = v.decode() if isinstance(v, bytes) else str(v)
                dead_letter_fields[key] = val

            await self._redis.xadd(
                self._settings.dead_letter_stream, dead_letter_fields
            )
            await self._redis.delete(retry_key)

    async def claim_stale(self, consumer_name: str) -> None:
        """Periodically claim messages stuck in pending state for > 60 seconds."""
        while self._running:
            try:
                # Check for pending messages older than 60 seconds
                pending = await self._redis.xpending_range(
                    name=self._stream,
                    groupname=self._group,
                    min="-",
                    max="+",
                    count=self._settings.batch_size,
                )

                stale_ids = []
                for entry in pending:
                    # entry has 'message_id', 'consumer', 'time_since_delivered', 'times_delivered'
                    idle_ms = entry.get("time_since_delivered", 0)
                    if idle_ms > 60_000:  # 60 seconds
                        stale_ids.append(entry["message_id"])

                if stale_ids:
                    claimed = await self._redis.xclaim(
                        name=self._stream,
                        groupname=self._group,
                        consumername=consumer_name,
                        min_idle_time=60_000,
                        message_ids=stale_ids,
                    )
                    if claimed:
                        logger.info(
                            "Claimed %d stale messages", len(claimed)
                        )

            except Exception:
                logger.exception("Error claiming stale messages")

            await asyncio.sleep(30)  # Check every 30 seconds

    def _shutdown(self) -> None:
        """Signal handler: stop the consumer loop after the current batch."""
        logger.info("Shutdown signal received, finishing current batch...")
        self._running = False
