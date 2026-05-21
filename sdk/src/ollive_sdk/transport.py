"""Async batch-and-flush HTTP transport with a sync wrapper."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from typing import Optional

import aiohttp

from ollive_sdk.types import InferenceLog

logger = logging.getLogger("ollive_sdk.transport")

_MAX_RETRIES = 1


class AsyncBatchTransport:
    """Non-blocking, batched HTTP transport.

    Logs are buffered in an :class:`asyncio.Queue` and flushed to the
    remote endpoint either when *flush_batch_size* items accumulate or
    every *flush_interval_s* seconds — whichever comes first.
    """

    def __init__(
        self,
        endpoint: str,
        api_key: Optional[str] = None,
        flush_interval_s: float = 2.0,
        flush_batch_size: int = 50,
        max_queue_size: int = 10_000,
    ) -> None:
        self.endpoint = endpoint
        self.api_key = api_key
        self.flush_interval_s = flush_interval_s
        self.flush_batch_size = flush_batch_size
        self._queue: asyncio.Queue[InferenceLog] = asyncio.Queue(
            maxsize=max_queue_size,
        )
        self._flush_task: Optional[asyncio.Task[None]] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._stopped = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the background flush loop."""
        self._stopped = False
        self._session = aiohttp.ClientSession()
        self._flush_task = asyncio.create_task(self._flush_loop())

    async def stop(self) -> None:
        """Flush remaining items and shut down."""
        self._stopped = True
        if self._flush_task is not None:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        # Drain whatever is left in the queue.
        await self._flush_remaining()
        if self._session is not None:
            await self._session.close()
            self._session = None

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------

    def enqueue(self, log: InferenceLog) -> None:
        """Non-blocking enqueue. Silently drops if the queue is full."""
        try:
            self._queue.put_nowait(log)
        except asyncio.QueueFull:
            logger.warning("Ollive transport queue full — log dropped.")

    # ------------------------------------------------------------------
    # Internal flush logic
    # ------------------------------------------------------------------

    async def _flush_loop(self) -> None:
        """Background loop: flush on interval or batch size."""
        while not self._stopped:
            batch: list[InferenceLog] = []
            try:
                # Wait for the first item (or timeout).
                try:
                    item = await asyncio.wait_for(
                        self._queue.get(),
                        timeout=self.flush_interval_s,
                    )
                    batch.append(item)
                except asyncio.TimeoutError:
                    # Interval elapsed with nothing — loop around.
                    continue

                # Drain up to flush_batch_size without blocking.
                while len(batch) < self.flush_batch_size:
                    try:
                        batch.append(self._queue.get_nowait())
                    except asyncio.QueueEmpty:
                        break

                if batch:
                    await self._send_batch(batch)
            except asyncio.CancelledError:
                # Send whatever we already collected before exiting.
                if batch:
                    await self._send_batch(batch)
                raise
            except Exception:
                logger.exception("Unexpected error in flush loop.")

    async def _flush_remaining(self) -> None:
        """Drain and send everything left in the queue."""
        batch: list[InferenceLog] = []
        while not self._queue.empty():
            try:
                batch.append(self._queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        if batch:
            await self._send_batch(batch)

    async def _send_batch(self, batch: list[InferenceLog]) -> None:
        """POST a JSON array of logs, retrying once on failure."""
        if self._session is None:
            return
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = json.dumps(
            [log.model_dump(mode="json") for log in batch],
        )

        for attempt in range(_MAX_RETRIES + 1):
            try:
                async with self._session.post(
                    self.endpoint,
                    data=payload,
                    headers=headers,
                ) as resp:
                    if resp.status < 300:
                        return
                    body = await resp.text()
                    logger.warning(
                        "Ollive transport POST %s — HTTP %d: %s",
                        self.endpoint,
                        resp.status,
                        body[:200],
                    )
            except Exception:
                logger.warning(
                    "Ollive transport POST failed (attempt %d/%d).",
                    attempt + 1,
                    _MAX_RETRIES + 1,
                    exc_info=True,
                )
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(0.5)

        logger.error(
            "Ollive transport: batch of %d logs dropped after retries.",
            len(batch),
        )


class SyncTransportWrapper:
    """Thin sync wrapper around :class:`AsyncBatchTransport`.

    Runs the async transport on a dedicated background thread with its
    own event loop, so callers never need ``await``.
    """

    def __init__(
        self,
        endpoint: str,
        api_key: Optional[str] = None,
        flush_interval_s: float = 2.0,
        flush_batch_size: int = 50,
        max_queue_size: int = 10_000,
    ) -> None:
        self._transport = AsyncBatchTransport(
            endpoint=endpoint,
            api_key=api_key,
            flush_interval_s=flush_interval_s,
            flush_batch_size=flush_batch_size,
            max_queue_size=max_queue_size,
        )
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(
            target=self._run_loop, daemon=True, name="ollive-transport"
        )
        self._thread.start()
        # Wait for the async transport to start.
        future = asyncio.run_coroutine_threadsafe(
            self._transport.start(), self._loop
        )
        future.result(timeout=5)

    def _run_loop(self) -> None:
        assert self._loop is not None
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def enqueue(self, log: InferenceLog) -> None:
        self._transport.enqueue(log)

    def stop(self) -> None:
        if self._loop is None:
            return
        future = asyncio.run_coroutine_threadsafe(
            self._transport.stop(), self._loop
        )
        future.result(timeout=10)
        self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread is not None:
            self._thread.join(timeout=5)
        self._loop = None
        self._thread = None
