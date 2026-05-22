"""Auto-instrumentation wrapper for the OpenAI Python SDK."""

from __future__ import annotations

import functools
import time
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ollive_sdk.providers.base import AbstractProviderWrapper
from ollive_sdk.types import InferenceLog, InferenceStatus

_PREVIEW_LIMIT = 200


class OpenAIWrapper(AbstractProviderWrapper):
    """Monkey-patches ``openai.chat.completions.create`` (sync and async)."""

    def wrap(self, module: Any) -> None:
        # Sync client
        sync_completions = getattr(
            getattr(getattr(module, "chat", None), "completions", None),
            "create",
            None,
        )
        if sync_completions is not None:
            self._originals["sync_create"] = sync_completions
            module.chat.completions.create = self._make_sync_wrapper(
                sync_completions
            )

        # Async client — patch AsyncCompletions.create on the class so every
        # AsyncOpenAI() instance is instrumented automatically.
        try:
            from openai.resources.chat.completions import AsyncCompletions
        except ImportError:
            AsyncCompletions = None  # type: ignore[misc,assignment]

        if AsyncCompletions is not None:
            original_async = AsyncCompletions.create
            self._originals["async_create"] = original_async
            AsyncCompletions.create = self._make_async_wrapper(original_async)  # type: ignore[assignment]

    def unwrap(self, module: Any) -> None:
        original = self._originals.get("sync_create")
        if original is not None:
            module.chat.completions.create = original

        original_async = self._originals.get("async_create")
        if original_async is not None:
            try:
                from openai.resources.chat.completions import AsyncCompletions
                AsyncCompletions.create = original_async  # type: ignore[assignment]
            except ImportError:
                pass

    # ------------------------------------------------------------------
    # Sync wrapper
    # ------------------------------------------------------------------

    def _make_sync_wrapper(self, original: Callable) -> Callable:
        enqueue_fn = self._enqueue_fn
        redact_fn = self._redact_fn

        @functools.wraps(original)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "unknown")
            stream = kwargs.get("stream", False)
            request_ts = datetime.now(timezone.utc)
            t0 = time.perf_counter()

            if stream:
                return _wrap_sync_stream(
                    original, args, kwargs, model, request_ts, t0,
                    enqueue_fn, redact_fn,
                )

            status = InferenceStatus.SUCCESS
            error_type: Optional[str] = None
            error_message: Optional[str] = None
            result = None
            try:
                result = original(*args, **kwargs)
                return result
            except Exception as exc:
                status = InferenceStatus.ERROR
                error_type = type(exc).__name__
                error_message = str(exc)[:500]
                raise
            finally:
                response_ts = datetime.now(timezone.utc)
                latency_ms = int((time.perf_counter() - t0) * 1000)
                prompt_t = comp_t = total_t = None
                output_preview = None
                if result is not None:
                    usage = getattr(result, "usage", None)
                    if usage:
                        prompt_t = getattr(usage, "prompt_tokens", None)
                        comp_t = getattr(usage, "completion_tokens", None)
                        total_t = getattr(usage, "total_tokens", None)
                    choices = getattr(result, "choices", None)
                    if choices and len(choices) > 0:
                        msg = getattr(choices[0], "message", None)
                        if msg:
                            content = getattr(msg, "content", None)
                            if isinstance(content, str):
                                output_preview = redact_fn(
                                    content[:_PREVIEW_LIMIT]
                                )
                # Build input preview from messages kwarg.
                input_preview = _messages_preview(
                    kwargs.get("messages"), redact_fn
                )
                log = InferenceLog(
                    provider="openai",
                    model=model,
                    request_timestamp=request_ts,
                    response_timestamp=response_ts,
                    latency_ms=latency_ms,
                    prompt_tokens=prompt_t,
                    completion_tokens=comp_t,
                    total_tokens=total_t,
                    status=status,
                    error_type=error_type,
                    error_message=error_message,
                    input_preview=input_preview,
                    output_preview=output_preview,
                    is_streaming=False,
                )
                enqueue_fn(log)

        return wrapper

    # ------------------------------------------------------------------
    # Async wrapper
    # ------------------------------------------------------------------

    def _make_async_wrapper(self, original: Callable) -> Callable:
        enqueue_fn = self._enqueue_fn
        redact_fn = self._redact_fn

        @functools.wraps(original)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "unknown")
            stream = kwargs.get("stream", False)
            request_ts = datetime.now(timezone.utc)
            t0 = time.perf_counter()

            if stream:
                return _wrap_async_stream(
                    original, args, kwargs, model, request_ts, t0,
                    enqueue_fn, redact_fn,
                )

            status = InferenceStatus.SUCCESS
            error_type: Optional[str] = None
            error_message: Optional[str] = None
            result = None
            try:
                result = await original(*args, **kwargs)
                return result
            except Exception as exc:
                status = InferenceStatus.ERROR
                error_type = type(exc).__name__
                error_message = str(exc)[:500]
                raise
            finally:
                response_ts = datetime.now(timezone.utc)
                latency_ms = int((time.perf_counter() - t0) * 1000)
                prompt_t = comp_t = total_t = None
                output_preview = None
                if result is not None:
                    usage = getattr(result, "usage", None)
                    if usage:
                        prompt_t = getattr(usage, "prompt_tokens", None)
                        comp_t = getattr(usage, "completion_tokens", None)
                        total_t = getattr(usage, "total_tokens", None)
                    choices = getattr(result, "choices", None)
                    if choices and len(choices) > 0:
                        msg = getattr(choices[0], "message", None)
                        if msg:
                            content = getattr(msg, "content", None)
                            if isinstance(content, str):
                                output_preview = redact_fn(
                                    content[:_PREVIEW_LIMIT]
                                )
                input_preview = _messages_preview(
                    kwargs.get("messages"), redact_fn
                )
                log = InferenceLog(
                    provider="openai",
                    model=model,
                    request_timestamp=request_ts,
                    response_timestamp=response_ts,
                    latency_ms=latency_ms,
                    prompt_tokens=prompt_t,
                    completion_tokens=comp_t,
                    total_tokens=total_t,
                    status=status,
                    error_type=error_type,
                    error_message=error_message,
                    input_preview=input_preview,
                    output_preview=output_preview,
                    is_streaming=False,
                )
                enqueue_fn(log)

        return wrapper


def _wrap_sync_stream(
    original: Callable,
    args: tuple,
    kwargs: dict,
    model: str,
    request_ts: datetime,
    t0: float,
    enqueue_fn: Callable,
    redact_fn: Callable,
):
    """Generator that wraps an OpenAI streaming response."""
    iterator = original(*args, **kwargs)
    chunks: list[str] = []
    chunk_count = 0
    first_token_ms: Optional[int] = None
    status = InferenceStatus.SUCCESS
    error_type: Optional[str] = None
    error_message: Optional[str] = None

    def gen():
        nonlocal chunk_count, first_token_ms, status, error_type, error_message
        try:
            for chunk in iterator:
                chunk_count += 1
                if chunk_count == 1:
                    first_token_ms = int((time.perf_counter() - t0) * 1000)
                choices = getattr(chunk, "choices", None)
                if choices and len(choices) > 0:
                    delta = getattr(choices[0], "delta", None)
                    if delta:
                        content = getattr(delta, "content", None)
                        if isinstance(content, str):
                            chunks.append(content)
                yield chunk
        except Exception as exc:
            status = InferenceStatus.ERROR
            error_type = type(exc).__name__
            error_message = str(exc)[:500]
            raise
        finally:
            response_ts = datetime.now(timezone.utc)
            stream_duration_ms = int((time.perf_counter() - t0) * 1000)
            accumulated = "".join(chunks)
            output_preview = (
                redact_fn(accumulated[:_PREVIEW_LIMIT]) if accumulated else None
            )
            input_preview = _messages_preview(
                kwargs.get("messages"), redact_fn
            )
            log = InferenceLog(
                provider="openai",
                model=model,
                request_timestamp=request_ts,
                response_timestamp=response_ts,
                latency_ms=stream_duration_ms,
                time_to_first_token_ms=first_token_ms,
                status=status,
                error_type=error_type,
                error_message=error_message,
                input_preview=input_preview,
                output_preview=output_preview,
                is_streaming=True,
                stream_chunk_count=chunk_count,
                stream_duration_ms=stream_duration_ms,
            )
            enqueue_fn(log)

    return gen()


async def _wrap_async_stream(
    original: Callable,
    args: tuple,
    kwargs: dict,
    model: str,
    request_ts: datetime,
    t0: float,
    enqueue_fn: Callable,
    redact_fn: Callable,
):
    """Async generator that wraps an OpenAI async streaming response."""
    iterator = await original(*args, **kwargs)
    chunks: list[str] = []
    chunk_count = 0
    first_token_ms: Optional[int] = None
    status = InferenceStatus.SUCCESS
    error_type: Optional[str] = None
    error_message: Optional[str] = None

    async def gen():
        nonlocal chunk_count, first_token_ms, status, error_type, error_message
        try:
            async for chunk in iterator:
                chunk_count += 1
                if chunk_count == 1:
                    first_token_ms = int((time.perf_counter() - t0) * 1000)
                choices = getattr(chunk, "choices", None)
                if choices and len(choices) > 0:
                    delta = getattr(choices[0], "delta", None)
                    if delta:
                        content = getattr(delta, "content", None)
                        if isinstance(content, str):
                            chunks.append(content)
                yield chunk
        except Exception as exc:
            status = InferenceStatus.ERROR
            error_type = type(exc).__name__
            error_message = str(exc)[:500]
            raise
        finally:
            response_ts = datetime.now(timezone.utc)
            stream_duration_ms = int((time.perf_counter() - t0) * 1000)
            accumulated = "".join(chunks)
            output_preview = (
                redact_fn(accumulated[:_PREVIEW_LIMIT]) if accumulated else None
            )
            input_preview = _messages_preview(
                kwargs.get("messages"), redact_fn
            )
            log = InferenceLog(
                provider="openai",
                model=model,
                request_timestamp=request_ts,
                response_timestamp=response_ts,
                latency_ms=stream_duration_ms,
                time_to_first_token_ms=first_token_ms,
                status=status,
                error_type=error_type,
                error_message=error_message,
                input_preview=input_preview,
                output_preview=output_preview,
                is_streaming=True,
                stream_chunk_count=chunk_count,
                stream_duration_ms=stream_duration_ms,
            )
            enqueue_fn(log)

    return gen()


def _messages_preview(
    messages: Any, redact_fn: Callable
) -> Optional[str]:
    """Build a truncated preview from the messages list."""
    if not messages or not isinstance(messages, list):
        return None
    last_msg = messages[-1]
    content = last_msg.get("content", "") if isinstance(last_msg, dict) else ""
    if isinstance(content, str) and content:
        return redact_fn(content[:_PREVIEW_LIMIT])
    return None
