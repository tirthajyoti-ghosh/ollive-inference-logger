"""Async context-manager variant of InferenceTracker."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from ollive_sdk.types import InferenceLog, InferenceStatus


class AsyncInferenceTracker:
    """Async context manager that records timing and metadata for one inference call.

    Usage::

        async with client.atrack(provider="openai", model="gpt-4o") as tracker:
            response = await openai_client.chat.completions.create(...)
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
    # Async context manager protocol
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "AsyncInferenceTracker":
        self._request_ts = datetime.now(timezone.utc)
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self._response_ts = datetime.now(timezone.utc)
        if exc_val is not None:
            self.set_error(exc_val)
        self.complete()
        return None  # Do not suppress exceptions.

    # ------------------------------------------------------------------
    # Setters (same interface as the sync InferenceTracker)
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
        if self._first_token_ts is None and self._request_ts is not None:
            self._first_token_ts = datetime.now(timezone.utc)

    @property
    def first_token_received(self) -> bool:
        return self._first_token_ts is not None

    # ------------------------------------------------------------------
    # Finalize
    # ------------------------------------------------------------------

    def complete(self) -> None:
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
            redact(self._input_text[:200]) if self._input_text else None
        )
        output_preview = (
            redact(self._output_text[:200]) if self._output_text else None
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
