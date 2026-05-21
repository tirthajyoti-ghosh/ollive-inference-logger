"""Auto-instrumentation wrapper for the Anthropic Python SDK."""

from __future__ import annotations

import functools
import time
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ollive_sdk.providers.base import AbstractProviderWrapper
from ollive_sdk.types import InferenceLog, InferenceStatus

_PREVIEW_LIMIT = 200


class AnthropicWrapper(AbstractProviderWrapper):
    """Monkey-patches ``anthropic.messages.create`` (sync)."""

    def wrap(self, module: Any) -> None:
        messages = getattr(module, "messages", None)
        if messages is None:
            # Try the client-level path: module.Anthropic → instance.messages
            # For module-level patching, the user typically passes a client instance.
            messages = getattr(module, "messages", None)
        if messages is not None:
            original = getattr(messages, "create", None)
            if original is not None:
                self._originals["sync_create"] = original
                self._originals["messages_obj"] = messages
                messages.create = self._make_sync_wrapper(original)

    def unwrap(self, module: Any) -> None:
        original = self._originals.get("sync_create")
        messages_obj = self._originals.get("messages_obj")
        if original is not None and messages_obj is not None:
            messages_obj.create = original

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
                        # Anthropic: input_tokens / output_tokens
                        prompt_t = getattr(usage, "input_tokens", None)
                        comp_t = getattr(usage, "output_tokens", None)
                        if prompt_t is not None and comp_t is not None:
                            total_t = prompt_t + comp_t
                    # Extract text from content blocks
                    content_blocks = getattr(result, "content", None)
                    if isinstance(content_blocks, list) and len(content_blocks) > 0:
                        text = getattr(content_blocks[0], "text", None)
                        if isinstance(text, str):
                            output_preview = redact_fn(text[:_PREVIEW_LIMIT])

                input_preview = _anthropic_input_preview(
                    kwargs.get("messages"), redact_fn
                )
                log = InferenceLog(
                    provider="anthropic",
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
    """Generator that wraps an Anthropic streaming response."""
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
            for event in iterator:
                chunk_count += 1
                if chunk_count == 1:
                    first_token_ms = int((time.perf_counter() - t0) * 1000)
                event_type = getattr(event, "type", "")
                if event_type == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    if delta:
                        text = getattr(delta, "text", None)
                        if isinstance(text, str):
                            chunks.append(text)
                yield event
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
            input_preview = _anthropic_input_preview(
                kwargs.get("messages"), redact_fn
            )
            log = InferenceLog(
                provider="anthropic",
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


def _anthropic_input_preview(
    messages: Any, redact_fn: Callable
) -> Optional[str]:
    """Build a truncated preview from the Anthropic messages list."""
    if not messages or not isinstance(messages, list):
        return None
    last_msg = messages[-1]
    content = last_msg.get("content", "") if isinstance(last_msg, dict) else ""
    if isinstance(content, str) and content:
        return redact_fn(content[:_PREVIEW_LIMIT])
    # Anthropic messages can have content as a list of blocks.
    if isinstance(content, list) and len(content) > 0:
        block = content[0]
        text = block.get("text", "") if isinstance(block, dict) else ""
        if isinstance(text, str) and text:
            return redact_fn(text[:_PREVIEW_LIMIT])
    return None
