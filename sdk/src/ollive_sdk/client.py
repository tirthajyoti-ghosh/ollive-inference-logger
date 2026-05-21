"""OlliveClient — main entry point for the SDK."""

from __future__ import annotations

import asyncio
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from ollive_sdk.context import AsyncInferenceTracker
from ollive_sdk.redactor import PIIRedactor, RedactionLevel
from ollive_sdk.transport import AsyncBatchTransport, SyncTransportWrapper
from ollive_sdk.types import InferenceLog, InferenceStatus

logger = logging.getLogger("ollive_sdk.client")

_PREVIEW_LIMIT = 200


class InferenceTracker:
    """Sync context manager that records timing and metadata for one inference call.

    Usage::

        with client.track(provider="openai", model="gpt-4o") as tracker:
            response = openai.chat.completions.create(...)
            tracker.set_usage(response.usage.prompt_tokens, response.usage.completion_tokens)
            tracker.set_output(response.choices[0].message.content)
    """

    def __init__(
        self,
        *,
        provider: str,
        model: str,
        session_id: Optional[str] = None,
        conversation_id: Optional[UUID] = None,
        message_id: Optional[UUID] = None,
        streaming: bool = False,
        _enqueue_fn: Any = None,
        _redact_fn: Any = None,
    ) -> None:
        self._provider = provider
        self._model = model
        self._session_id = session_id
        self._conversation_id = conversation_id
        self._message_id = message_id
        self._streaming = streaming
        self._enqueue_fn = _enqueue_fn
        self._redact_fn = _redact_fn

        self._request_ts: Optional[datetime] = None
        self._response_ts: Optional[datetime] = None
        self._first_token_ts: Optional[datetime] = None
        self._prompt_tokens: Optional[int] = None
        self._completion_tokens: Optional[int] = None
        self._total_tokens: Optional[int] = None
        self._input_text: Optional[str] = None
        self._output_text: Optional[str] = None
        self._metadata: dict = {}
        self._status: InferenceStatus = InferenceStatus.SUCCESS
        self._error_type: Optional[str] = None
        self._error_message: Optional[str] = None
        self._http_status_code: Optional[int] = None
        self._stream_chunk_count: Optional[int] = None
        self._stream_duration_ms: Optional[int] = None

    # ------------------------------------------------------------------
    # Context manager protocol
    # ------------------------------------------------------------------

    def __enter__(self) -> "InferenceTracker":
        self._request_ts = datetime.now(timezone.utc)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self._response_ts = datetime.now(timezone.utc)
        if exc_val is not None:
            self.set_error(exc_val)
        self.complete()

    # ------------------------------------------------------------------
    # Setters
    # ------------------------------------------------------------------

    def set_usage(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: Optional[int] = None,
    ) -> None:
        self._prompt_tokens = prompt_tokens
        self._completion_tokens = completion_tokens
        self._total_tokens = (
            total_tokens
            if total_tokens is not None
            else prompt_tokens + completion_tokens
        )

    def set_output(self, text: str) -> None:
        self._output_text = text

    def set_input(self, text: str) -> None:
        self._input_text = text

    def set_metadata(self, data: dict) -> None:
        self._metadata.update(data)

    def set_error(self, exception: BaseException) -> None:
        self._status = InferenceStatus.ERROR
        self._error_type = type(exception).__name__
        self._error_message = str(exception)[:500]

    def record_first_token(self) -> None:
        """Record the time the first token was received."""
        if self._first_token_ts is None and self._request_ts is not None:
            self._first_token_ts = datetime.now(timezone.utc)

    @property
    def first_token_received(self) -> bool:
        return self._first_token_ts is not None

    # ------------------------------------------------------------------
    # Finalize
    # ------------------------------------------------------------------

    def complete(self) -> None:
        """Build the InferenceLog and enqueue it for transport."""
        if self._response_ts is None:
            self._response_ts = datetime.now(timezone.utc)

        latency_ms: Optional[int] = None
        if self._request_ts and self._response_ts:
            latency_ms = int(
                (self._response_ts - self._request_ts).total_seconds() * 1000
            )

        ttft_ms: Optional[int] = None
        if self._first_token_ts and self._request_ts:
            ttft_ms = int(
                (self._first_token_ts - self._request_ts).total_seconds() * 1000
            )

        redact = self._redact_fn or (lambda t: t)
        input_preview = (
            redact(self._input_text[:_PREVIEW_LIMIT])
            if self._input_text
            else None
        )
        output_preview = (
            redact(self._output_text[:_PREVIEW_LIMIT])
            if self._output_text
            else None
        )

        log = InferenceLog(
            provider=self._provider,
            model=self._model,
            session_id=self._session_id,
            conversation_id=self._conversation_id,
            message_id=self._message_id,
            request_timestamp=self._request_ts or datetime.now(timezone.utc),
            response_timestamp=self._response_ts,
            latency_ms=latency_ms,
            time_to_first_token_ms=ttft_ms,
            prompt_tokens=self._prompt_tokens,
            completion_tokens=self._completion_tokens,
            total_tokens=self._total_tokens,
            status=self._status,
            error_type=self._error_type,
            error_message=self._error_message,
            http_status_code=self._http_status_code,
            input_preview=input_preview,
            output_preview=output_preview,
            is_streaming=self._streaming,
            stream_chunk_count=self._stream_chunk_count,
            stream_duration_ms=self._stream_duration_ms,
            metadata=self._metadata,
        )
        if self._enqueue_fn:
            self._enqueue_fn(log)


class OlliveClient:
    """Main SDK entry point.

    Parameters
    ----------
    endpoint : str
        URL of the Ollive ingest endpoint.
    api_key : str, optional
        Bearer token sent with every batch POST.
    flush_interval_s : float
        Maximum seconds between flushes.
    flush_batch_size : int
        Flush when this many logs are queued.
    max_queue_size : int
        Hard upper bound on the in-memory queue.
    redact_pii : bool
        Enable PII redaction on input/output previews.
    pii_redaction_level : RedactionLevel
        ``"off"``, ``"standard"``, or ``"aggressive"``.
    """

    def __init__(
        self,
        endpoint: str,
        api_key: Optional[str] = None,
        flush_interval_s: float = 2.0,
        flush_batch_size: int = 50,
        max_queue_size: int = 10_000,
        redact_pii: bool = True,
        pii_redaction_level: RedactionLevel = "standard",
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._flush_interval_s = flush_interval_s
        self._flush_batch_size = flush_batch_size
        self._max_queue_size = max_queue_size

        self._redactor = (
            PIIRedactor(level=pii_redaction_level) if redact_pii else None
        )
        self._async_transport: Optional[AsyncBatchTransport] = None
        self._sync_transport: Optional[SyncTransportWrapper] = None
        self._started = False

    # ------------------------------------------------------------------
    # Transport bootstrap (lazy)
    # ------------------------------------------------------------------

    def _ensure_transport(self) -> None:
        """Lazily start a transport appropriate for the calling context."""
        if self._started:
            return
        try:
            asyncio.get_running_loop()
            is_async = True
        except RuntimeError:
            is_async = False

        if is_async:
            self._async_transport = AsyncBatchTransport(
                endpoint=self._endpoint,
                api_key=self._api_key,
                flush_interval_s=self._flush_interval_s,
                flush_batch_size=self._flush_batch_size,
                max_queue_size=self._max_queue_size,
            )
            # Schedule the start coroutine on the running loop.
            loop = asyncio.get_running_loop()
            loop.create_task(self._async_transport.start())
        else:
            self._sync_transport = SyncTransportWrapper(
                endpoint=self._endpoint,
                api_key=self._api_key,
                flush_interval_s=self._flush_interval_s,
                flush_batch_size=self._flush_batch_size,
                max_queue_size=self._max_queue_size,
            )
            self._sync_transport.start()
        self._started = True

    def _enqueue(self, log: InferenceLog) -> None:
        self._ensure_transport()
        if self._async_transport:
            self._async_transport.enqueue(log)
        elif self._sync_transport:
            self._sync_transport.enqueue(log)

    def _redact(self, text: str) -> str:
        if self._redactor:
            return self._redactor.redact(text)
        return text

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @contextmanager
    def track(
        self,
        provider: str,
        model: str,
        session_id: Optional[str] = None,
        conversation_id: Optional[UUID] = None,
        message_id: Optional[UUID] = None,
        streaming: bool = False,
    ):
        """Sync context manager that creates an :class:`InferenceTracker`."""
        tracker = InferenceTracker(
            provider=provider,
            model=model,
            session_id=session_id,
            conversation_id=conversation_id,
            message_id=message_id,
            streaming=streaming,
            _enqueue_fn=self._enqueue,
            _redact_fn=self._redact,
        )
        with tracker:
            yield tracker

    def atrack(
        self,
        provider: str,
        model: str,
        session_id: Optional[str] = None,
        conversation_id: Optional[UUID] = None,
        message_id: Optional[UUID] = None,
        streaming: bool = False,
    ) -> AsyncInferenceTracker:
        """Return an :class:`AsyncInferenceTracker` for use with ``async with``."""
        return AsyncInferenceTracker(
            provider=provider,
            model=model,
            session_id=session_id,
            conversation_id=conversation_id,
            message_id=message_id,
            streaming=streaming,
            _enqueue_fn=self._enqueue,
            _redact_fn=self._redact,
        )

    def log(self, inference_log: InferenceLog) -> None:
        """Manually submit a pre-built :class:`InferenceLog`."""
        self._enqueue(inference_log)

    def instrument_openai(self, openai_module: Any) -> None:
        """Auto-instrument the ``openai`` module."""
        from ollive_sdk.providers.openai_wrapper import OpenAIWrapper

        wrapper = OpenAIWrapper(enqueue_fn=self._enqueue, redact_fn=self._redact)
        wrapper.wrap(openai_module)

    def instrument_anthropic(self, anthropic_module: Any) -> None:
        """Auto-instrument the ``anthropic`` module."""
        from ollive_sdk.providers.anthropic_wrapper import AnthropicWrapper

        wrapper = AnthropicWrapper(enqueue_fn=self._enqueue, redact_fn=self._redact)
        wrapper.wrap(anthropic_module)

    def close(self) -> None:
        """Flush remaining logs and shut down transport."""
        if self._sync_transport:
            self._sync_transport.stop()
            self._sync_transport = None
        if self._async_transport:
            # Best-effort: schedule the stop on the running loop.
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._async_transport.stop())
            except RuntimeError:
                # No running loop — create one just for shutdown.
                asyncio.run(self._async_transport.stop())
            self._async_transport = None
        self._started = False
