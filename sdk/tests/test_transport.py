"""Tests for AsyncBatchTransport."""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from ollive_sdk.transport import AsyncBatchTransport
from ollive_sdk.types import InferenceLog


def _make_log(**overrides) -> InferenceLog:
    defaults = {
        "provider": "test",
        "model": "test-model",
        "request_timestamp": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    return InferenceLog(**defaults)


@pytest.mark.asyncio
async def test_flush_on_batch_size():
    """Transport flushes when flush_batch_size items are queued."""
    transport = AsyncBatchTransport(
        endpoint="http://localhost:9999/ingest",
        flush_batch_size=3,
        flush_interval_s=60,  # Long interval so only batch-size triggers.
        max_queue_size=100,
    )

    sent_batches: list[list] = []

    async def mock_send_batch(batch):
        sent_batches.append(batch)

    transport._send_batch = mock_send_batch  # type: ignore[assignment]
    await transport.start()

    for _ in range(3):
        transport.enqueue(_make_log())

    # Give the flush loop a moment to pick up and process.
    await asyncio.sleep(0.3)
    await transport.stop()

    assert len(sent_batches) >= 1
    total_sent = sum(len(b) for b in sent_batches)
    assert total_sent == 3


@pytest.mark.asyncio
async def test_flush_on_interval():
    """Transport flushes on interval even if batch size not reached."""
    transport = AsyncBatchTransport(
        endpoint="http://localhost:9999/ingest",
        flush_batch_size=100,  # Large so only interval triggers.
        flush_interval_s=0.2,
        max_queue_size=100,
    )

    sent_batches: list[list] = []

    async def mock_send_batch(batch):
        sent_batches.append(batch)

    transport._send_batch = mock_send_batch  # type: ignore[assignment]
    await transport.start()

    transport.enqueue(_make_log())
    # Wait longer than the flush interval.
    await asyncio.sleep(0.5)
    await transport.stop()

    assert len(sent_batches) >= 1
    total_sent = sum(len(b) for b in sent_batches)
    assert total_sent == 1


@pytest.mark.asyncio
async def test_queue_full_drops():
    """When the queue is full, enqueue drops silently."""
    transport = AsyncBatchTransport(
        endpoint="http://localhost:9999/ingest",
        flush_batch_size=1000,
        flush_interval_s=60,
        max_queue_size=5,
    )
    # Don't start the transport so nothing drains.

    for _ in range(10):
        transport.enqueue(_make_log())

    assert transport._queue.qsize() == 5


@pytest.mark.asyncio
async def test_flush_remaining_on_stop():
    """stop() flushes whatever is left in the queue."""
    transport = AsyncBatchTransport(
        endpoint="http://localhost:9999/ingest",
        flush_batch_size=1000,
        flush_interval_s=60,
        max_queue_size=100,
    )

    sent_batches: list[list] = []

    async def mock_send_batch(batch):
        sent_batches.append(batch)

    transport._send_batch = mock_send_batch  # type: ignore[assignment]
    await transport.start()

    transport.enqueue(_make_log())
    transport.enqueue(_make_log())

    # Stop immediately — the batch size / interval wouldn't have fired yet.
    await transport.stop()

    total_sent = sum(len(b) for b in sent_batches)
    assert total_sent == 2


@pytest.mark.asyncio
async def test_send_batch_retry():
    """_send_batch retries once on failure then gives up."""
    transport = AsyncBatchTransport(
        endpoint="http://localhost:9999/ingest",
        max_queue_size=100,
    )

    call_count = 0

    # Create a mock session that always fails.
    mock_response = AsyncMock()
    mock_response.status = 500
    mock_response.text = AsyncMock(return_value="Internal Server Error")
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    mock_session = AsyncMock()

    async def mock_post(*a, **kw):
        nonlocal call_count
        call_count += 1
        return mock_response

    mock_session.post = mock_post
    transport._session = mock_session

    batch = [_make_log()]
    await transport._send_batch(batch)

    # 1 initial attempt + 1 retry = 2.
    assert call_count == 2
