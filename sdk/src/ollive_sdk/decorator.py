"""@track_inference decorator for sync and async functions."""

from __future__ import annotations

import asyncio
import functools
import time
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ollive_sdk.types import InferenceLog, InferenceStatus

_PREVIEW_LIMIT = 200


def _extract_usage(result: Any) -> tuple[Optional[int], Optional[int], Optional[int]]:
    """Extract token usage from OpenAI / LiteLLM-compatible response objects."""
    usage = getattr(result, "usage", None)
    if usage is None:
        return None, None, None
    prompt = getattr(usage, "prompt_tokens", None)
    completion = getattr(usage, "completion_tokens", None)
    total = getattr(usage, "total_tokens", None)
    if total is None and prompt is not None and completion is not None:
        total = prompt + completion
    return prompt, completion, total


def _extract_output(result: Any) -> Optional[str]:
    """Best-effort extraction of text output from an OpenAI-compatible response."""
    choices = getattr(result, "choices", None)
    if choices and len(choices) > 0:
        message = getattr(choices[0], "message", None)
        if message:
            content = getattr(message, "content", None)
            if isinstance(content, str):
                return content
    # Anthropic-style
    content_list = getattr(result, "content", None)
    if isinstance(content_list, list) and len(content_list) > 0:
        text = getattr(content_list[0], "text", None)
        if isinstance(text, str):
            return text
    return None


def track_inference(
    client: Any,
    provider: str,
    model: str,
    session_id: Optional[str] = None,
    streaming: bool = False,
) -> Callable:
    """Decorator that wraps a function with inference logging.

    Works with both sync and async functions. When ``streaming=True``,
    wraps the returned iterator/async-iterator to capture per-chunk
    timing and output accumulation.
    """
    enqueue_fn = client._enqueue
    redact_fn = client._redact

    def decorator(fn: Callable) -> Callable:
        if asyncio.iscoroutinefunction(fn):
            return _wrap_async(
                fn, provider, model, session_id, streaming, enqueue_fn, redact_fn
            )
        return _wrap_sync(
            fn, provider, model, session_id, streaming, enqueue_fn, redact_fn
        )

    return decorator


# ------------------------------------------------------------------
# Sync wrapper
# ------------------------------------------------------------------

def _wrap_sync(
    fn: Callable,
    provider: str,
    model: str,
    session_id: Optional[str],
    streaming: bool,
    enqueue_fn: Callable,
    redact_fn: Callable,
) -> Callable:
    @functools.wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        request_ts = datetime.now(timezone.utc)
        t0 = time.perf_counter()

        if streaming:
            return _sync_streaming_wrapper(
                fn, args, kwargs, provider, model, session_id,
                request_ts, t0, enqueue_fn, redact_fn,
            )

        # Non-streaming sync
        status = InferenceStatus.SUCCESS
        error_type: Optional[str] = None
        error_message: Optional[str] = None
        result = None
        try:
            result = fn(*args, **kwargs)
            return result
        except Exception as exc:
            status = InferenceStatus.ERROR
            error_type = type(exc).__name__
            error_message = str(exc)[:500]
            raise
        finally:
            response_ts = datetime.now(timezone.utc)
            latency_ms = int((time.perf_counter() - t0) * 1000)
            prompt_t, comp_t, total_t = _extract_usage(result) if result else (None, None, None)
            output_text = _extract_output(result) if result else None
            output_preview = (
                redact_fn(output_text[:_PREVIEW_LIMIT])
                if output_text
                else None
            )
            log = InferenceLog(
                provider=provider,
                model=model,
                session_id=session_id,
                request_timestamp=request_ts,
                response_timestamp=response_ts,
                latency_ms=latency_ms,
                prompt_tokens=prompt_t,
                completion_tokens=comp_t,
                total_tokens=total_t,
                status=status,
                error_type=error_type,
                error_message=error_message,
                output_preview=output_preview,
                is_streaming=False,
            )
            enqueue_fn(log)

    return wrapper


def _sync_streaming_wrapper(
    fn: Callable,
    args: tuple,
    kwargs: dict,
    provider: str,
    model: str,
    session_id: Optional[str],
    request_ts: datetime,
    t0: float,
    enqueue_fn: Callable,
    redact_fn: Callable,
):
    """Return a generator that wraps the original streaming iterator."""
    iterator = fn(*args, **kwargs)
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
                # Accumulate text for preview.
                text = _extract_chunk_text(chunk)
                if text:
                    chunks.append(text)
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
            log = InferenceLog(
                provider=provider,
                model=model,
                session_id=session_id,
                request_timestamp=request_ts,
                response_timestamp=response_ts,
                latency_ms=stream_duration_ms,
                time_to_first_token_ms=first_token_ms,
                status=status,
                error_type=error_type,
                error_message=error_message,
                output_preview=output_preview,
                is_streaming=True,
                stream_chunk_count=chunk_count,
                stream_duration_ms=stream_duration_ms,
            )
            enqueue_fn(log)

    return gen()


# ------------------------------------------------------------------
# Async wrapper
# ------------------------------------------------------------------

def _wrap_async(
    fn: Callable,
    provider: str,
    model: str,
    session_id: Optional[str],
    streaming: bool,
    enqueue_fn: Callable,
    redact_fn: Callable,
) -> Callable:
    @functools.wraps(fn)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        request_ts = datetime.now(timezone.utc)
        t0 = time.perf_counter()

        if streaming:
            return _async_streaming_wrapper(
                fn, args, kwargs, provider, model, session_id,
                request_ts, t0, enqueue_fn, redact_fn,
            )

        status = InferenceStatus.SUCCESS
        error_type: Optional[str] = None
        error_message: Optional[str] = None
        result = None
        try:
            result = await fn(*args, **kwargs)
            return result
        except Exception as exc:
            status = InferenceStatus.ERROR
            error_type = type(exc).__name__
            error_message = str(exc)[:500]
            raise
        finally:
            response_ts = datetime.now(timezone.utc)
            latency_ms = int((time.perf_counter() - t0) * 1000)
            prompt_t, comp_t, total_t = _extract_usage(result) if result else (None, None, None)
            output_text = _extract_output(result) if result else None
            output_preview = (
                redact_fn(output_text[:_PREVIEW_LIMIT])
                if output_text
                else None
            )
            log = InferenceLog(
                provider=provider,
                model=model,
                session_id=session_id,
                request_timestamp=request_ts,
                response_timestamp=response_ts,
                latency_ms=latency_ms,
                prompt_tokens=prompt_t,
                completion_tokens=comp_t,
                total_tokens=total_t,
                status=status,
                error_type=error_type,
                error_message=error_message,
                output_preview=output_preview,
                is_streaming=False,
            )
            enqueue_fn(log)

    return wrapper


async def _async_streaming_wrapper(
    fn: Callable,
    args: tuple,
    kwargs: dict,
    provider: str,
    model: str,
    session_id: Optional[str],
    request_ts: datetime,
    t0: float,
    enqueue_fn: Callable,
    redact_fn: Callable,
):
    """Return an async generator wrapping the original async streaming iterator."""
    iterator = await fn(*args, **kwargs)
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
                text = _extract_chunk_text(chunk)
                if text:
                    chunks.append(text)
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
            log = InferenceLog(
                provider=provider,
                model=model,
                session_id=session_id,
                request_timestamp=request_ts,
                response_timestamp=response_ts,
                latency_ms=stream_duration_ms,
                time_to_first_token_ms=first_token_ms,
                status=status,
                error_type=error_type,
                error_message=error_message,
                output_preview=output_preview,
                is_streaming=True,
                stream_chunk_count=chunk_count,
                stream_duration_ms=stream_duration_ms,
            )
            enqueue_fn(log)

    return gen()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _extract_chunk_text(chunk: Any) -> Optional[str]:
    """Pull text content from a streaming chunk (OpenAI / Anthropic format)."""
    # OpenAI streaming format
    choices = getattr(chunk, "choices", None)
    if choices and len(choices) > 0:
        delta = getattr(choices[0], "delta", None)
        if delta:
            content = getattr(delta, "content", None)
            if isinstance(content, str):
                return content
    # Anthropic streaming format
    if hasattr(chunk, "type"):
        chunk_type = getattr(chunk, "type", "")
        if chunk_type == "content_block_delta":
            delta = getattr(chunk, "delta", None)
            if delta:
                text = getattr(delta, "text", None)
                if isinstance(text, str):
                    return text
    # Plain string chunks
    if isinstance(chunk, str):
        return chunk
    return None
