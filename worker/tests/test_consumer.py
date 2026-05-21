import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.worker.config import WorkerSettings
from src.worker.consumer import InferenceLogConsumer
from src.worker.processor import ProcessingResult


@pytest.fixture
def settings():
    return WorkerSettings(
        redis_url="redis://localhost:6379",
        stream_name="test:stream",
        consumer_group="test-group",
        dead_letter_stream="test:stream:dead",
        batch_size=10,
        block_ms=100,
        max_retries=3,
    )


@pytest.fixture
def mock_redis():
    client = AsyncMock()
    client.xgroup_create = AsyncMock()
    client.xreadgroup = AsyncMock(return_value=[])
    client.xack = AsyncMock()
    client.xadd = AsyncMock()
    client.xpending_range = AsyncMock(return_value=[])
    client.xclaim = AsyncMock(return_value=[])
    client.incr = AsyncMock(return_value=1)
    client.expire = AsyncMock()
    client.delete = AsyncMock()
    return client


@pytest.fixture
def mock_pipeline():
    pipeline = AsyncMock()
    pipeline.process_batch = AsyncMock(
        return_value=ProcessingResult(processed=1, failed=0, errors=[])
    )
    return pipeline


@pytest.fixture
def consumer(mock_redis, mock_pipeline, settings):
    return InferenceLogConsumer(
        redis_client=mock_redis,
        pipeline=mock_pipeline,
        settings=settings,
    )


class TestConsumerGroupCreation:
    @pytest.mark.asyncio
    async def test_creates_consumer_group(self, consumer, mock_redis):
        await consumer.create_consumer_group()
        mock_redis.xgroup_create.assert_called_once_with(
            name="test:stream",
            groupname="test-group",
            id="0",
            mkstream=True,
        )

    @pytest.mark.asyncio
    async def test_ignores_existing_group(self, consumer, mock_redis):
        """BUSYGROUP error means the group already exists — should not raise."""
        import redis as redis_lib
        mock_redis.xgroup_create.side_effect = redis_lib.ResponseError(
            "BUSYGROUP Consumer Group name already exists"
        )
        # Should not raise
        await consumer.create_consumer_group()

    @pytest.mark.asyncio
    async def test_raises_on_other_redis_error(self, consumer, mock_redis):
        import redis as redis_lib
        mock_redis.xgroup_create.side_effect = redis_lib.ResponseError(
            "WRONGTYPE Operation against a key holding the wrong kind of value"
        )
        with pytest.raises(redis_lib.ResponseError):
            await consumer.create_consumer_group()


class TestMessageProcessing:
    @pytest.mark.asyncio
    async def test_processes_messages_and_acks(
        self, consumer, mock_redis, mock_pipeline
    ):
        """Simulate one iteration: read messages, process, ACK."""
        msg_id = b"1234567890-0"
        msg_fields = {b"data": b'{"provider": "openai", "model": "gpt-4o", "request_timestamp": "2025-05-21T10:00:00+00:00"}'}

        # First call returns messages, second call returns empty (then we stop)
        call_count = 0

        async def xreadgroup_side_effect(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [(b"test:stream", [(msg_id, msg_fields)])]
            # Stop the consumer after first iteration
            consumer._running = False
            return []

        mock_redis.xreadgroup = AsyncMock(side_effect=xreadgroup_side_effect)

        # Patch signal handlers since we're not running in a full event loop
        with patch("src.worker.consumer.asyncio.get_running_loop") as mock_loop:
            mock_loop_instance = MagicMock()
            mock_loop.return_value = mock_loop_instance

            await consumer.run("test-consumer")

        # Verify pipeline was called
        assert mock_pipeline.process_batch.called

        # Verify ACK was called
        mock_redis.xack.assert_called()

    @pytest.mark.asyncio
    async def test_handles_empty_stream(self, consumer, mock_redis, mock_pipeline):
        """No messages should result in no processing."""
        call_count = 0

        async def xreadgroup_side_effect(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                consumer._running = False
            return []

        mock_redis.xreadgroup = AsyncMock(side_effect=xreadgroup_side_effect)

        with patch("src.worker.consumer.asyncio.get_running_loop") as mock_loop:
            mock_loop.return_value = MagicMock()
            await consumer.run("test-consumer")

        mock_pipeline.process_batch.assert_not_called()


class TestDeadLetterHandling:
    @pytest.mark.asyncio
    async def test_moves_to_dead_letter_after_max_retries(
        self, consumer, mock_redis, settings
    ):
        """After max_retries, message goes to dead-letter stream."""
        mock_redis.incr = AsyncMock(return_value=settings.max_retries + 1)

        msg_id = b"1234567890-0"
        fields = {b"data": b"invalid json"}

        await consumer._handle_failed_message(msg_id, fields, "parse error")

        # Should add to dead-letter stream
        mock_redis.xadd.assert_called_once()
        call_args = mock_redis.xadd.call_args
        assert call_args[0][0] == "test:stream:dead"

        # Should clean up retry counter
        mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_increments_retry_counter(self, consumer, mock_redis):
        """Below max retries, just increments the counter."""
        mock_redis.incr = AsyncMock(return_value=1)

        msg_id = b"1234567890-0"
        fields = {b"data": b"bad"}

        await consumer._handle_failed_message(msg_id, fields, "error")

        mock_redis.incr.assert_called_once()
        mock_redis.expire.assert_called_once()
        # Should NOT add to dead-letter
        mock_redis.xadd.assert_not_called()


class TestShutdown:
    def test_shutdown_sets_running_false(self, consumer):
        consumer._running = True
        consumer._shutdown()
        assert consumer._running is False


class TestClaimStale:
    @pytest.mark.asyncio
    async def test_claims_old_pending_messages(self, consumer, mock_redis):
        """Should claim messages pending for more than 60 seconds."""
        mock_redis.xpending_range = AsyncMock(
            return_value=[
                {
                    "message_id": b"1234-0",
                    "consumer": b"old-consumer",
                    "time_since_delivered": 120_000,
                    "times_delivered": 3,
                }
            ]
        )
        mock_redis.xclaim = AsyncMock(return_value=[(b"1234-0", {})])

        # Run one iteration then stop
        consumer._running = True

        async def stop_after_one(*args, **kwargs):
            consumer._running = False

        with patch("src.worker.consumer.asyncio.sleep", side_effect=stop_after_one):
            await consumer.claim_stale("test-consumer")

        mock_redis.xclaim.assert_called_once_with(
            name="test:stream",
            groupname="test-group",
            consumername="test-consumer",
            min_idle_time=60_000,
            message_ids=[b"1234-0"],
        )

    @pytest.mark.asyncio
    async def test_skips_recent_pending_messages(self, consumer, mock_redis):
        """Messages pending less than 60s should not be claimed."""
        mock_redis.xpending_range = AsyncMock(
            return_value=[
                {
                    "message_id": b"5678-0",
                    "consumer": b"active-consumer",
                    "time_since_delivered": 10_000,
                    "times_delivered": 1,
                }
            ]
        )

        consumer._running = True

        async def stop_after_one(*args, **kwargs):
            consumer._running = False

        with patch("src.worker.consumer.asyncio.sleep", side_effect=stop_after_one):
            await consumer.claim_stale("test-consumer")

        mock_redis.xclaim.assert_not_called()
