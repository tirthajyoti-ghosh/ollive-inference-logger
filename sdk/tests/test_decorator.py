"""Tests for the @track_inference decorator."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Optional
from unittest.mock import MagicMock

import pytest

from ollive_sdk.decorator import track_inference
from ollive_sdk.types import InferenceLog, InferenceStatus


def _make_mock_client():
    """Create a minimal mock that looks like OlliveClient to the decorator."""
    logs: list[InferenceLog] = []
    client = MagicMock()
    client._enqueue = lambda log: logs.append(log)
    client._redact = lambda text: text
    client._logs = logs
    return client


# ------------------------------------------------------------------
# Sync non-streaming
# ------------------------------------------------------------------


class TestSyncDecorator:
    def test_timing_capture(self):
        client = _make_mock_client()

        @track_inference(client, provider="openai", model="gpt-4o")
        def my_call():
            time.sleep(0.05)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="hello"))],
                usage=SimpleNamespace(
                    prompt_tokens=10, completion_tokens=5, total_tokens=15
                ),
            )

        result = my_call()
        assert result.choices[0].message.content == "hello"
        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.provider == "openai"
        assert log.model == "gpt-4o"
        assert log.latency_ms >= 40  # At least ~50ms sleep.
        assert log.prompt_tokens == 10
        assert log.completion_tokens == 5
        assert log.total_tokens == 15
        assert log.status == InferenceStatus.SUCCESS
        assert log.output_preview == "hello"

    def test_error_handling(self):
        client = _make_mock_client()

        @track_inference(client, provider="openai", model="gpt-4o")
        def failing_call():
            raise ValueError("something broke")

        with pytest.raises(ValueError, match="something broke"):
            failing_call()

        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.status == InferenceStatus.ERROR
        assert log.error_type == "ValueError"
        assert "something broke" in (log.error_message or "")

    def test_no_usage_attribute(self):
        """Functions returning plain values should not crash."""
        client = _make_mock_client()

        @track_inference(client, provider="custom", model="custom-v1")
        def plain_call():
            return "just a string"

        result = plain_call()
        assert result == "just a string"
        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.prompt_tokens is None


# ------------------------------------------------------------------
# Sync streaming
# ------------------------------------------------------------------


class TestSyncStreamingDecorator:
    def test_streaming_wrapper(self):
        client = _make_mock_client()

        @track_inference(client, provider="openai", model="gpt-4o", streaming=True)
        def my_stream():
            for word in ["Hello", " ", "world"]:
                yield word

        chunks = list(my_stream())
        assert chunks == ["Hello", " ", "world"]
        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.is_streaming is True
        assert log.stream_chunk_count == 3
        assert log.time_to_first_token_ms is not None
        assert log.output_preview == "Hello world"

    def test_streaming_error(self):
        client = _make_mock_client()

        @track_inference(client, provider="openai", model="gpt-4o", streaming=True)
        def bad_stream():
            yield "ok"
            raise RuntimeError("stream died")

        gen = bad_stream()
        first = next(gen)
        assert first == "ok"
        with pytest.raises(RuntimeError, match="stream died"):
            next(gen)

        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.status == InferenceStatus.ERROR
        assert log.error_type == "RuntimeError"


# ------------------------------------------------------------------
# Async non-streaming
# ------------------------------------------------------------------


class TestAsyncDecorator:
    @pytest.mark.asyncio
    async def test_async_timing_capture(self):
        client = _make_mock_client()

        @track_inference(client, provider="anthropic", model="claude-3")
        async def my_async_call():
            await asyncio.sleep(0.05)
            return SimpleNamespace(
                content=[SimpleNamespace(text="hi from claude")],
                usage=SimpleNamespace(
                    prompt_tokens=8, completion_tokens=3, total_tokens=11
                ),
            )

        result = await my_async_call()
        assert result.content[0].text == "hi from claude"
        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.latency_ms >= 40
        assert log.status == InferenceStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_async_error_handling(self):
        client = _make_mock_client()

        @track_inference(client, provider="anthropic", model="claude-3")
        async def failing_async():
            raise ConnectionError("timeout")

        with pytest.raises(ConnectionError, match="timeout"):
            await failing_async()

        assert len(client._logs) == 1
        log = client._logs[0]
        assert log.status == InferenceStatus.ERROR
        assert log.error_type == "ConnectionError"
