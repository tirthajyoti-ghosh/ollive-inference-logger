import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.worker.models import InferenceLog
from src.worker.redactor import DeepRedactor, SimpleRedactor

logger = logging.getLogger(__name__)

# Per-token pricing (provider, model) -> {"input": cost_per_token, "output": cost_per_token}
PRICING: dict[tuple[str, str], dict[str, float]] = {
    ("openai", "gpt-4o"): {"input": 2.50 / 1_000_000, "output": 10.00 / 1_000_000},
    ("openai", "gpt-4o-mini"): {"input": 0.15 / 1_000_000, "output": 0.60 / 1_000_000},
    ("openai", "gpt-3.5-turbo"): {"input": 0.50 / 1_000_000, "output": 1.50 / 1_000_000},
    ("anthropic", "claude-sonnet-4-20250514"): {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
    ("anthropic", "claude-haiku-4-20250414"): {"input": 0.80 / 1_000_000, "output": 4.00 / 1_000_000},
    ("groq", "llama-3.1-70b-versatile"): {"input": 0.59 / 1_000_000, "output": 0.79 / 1_000_000},
}


class InferenceLogData(BaseModel):
    """Pydantic model for validating incoming inference log messages."""

    id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    message_id: uuid.UUID | None = None
    session_id: str | None = None
    provider: str
    model: str
    request_timestamp: datetime
    response_timestamp: datetime | None = None
    latency_ms: int | None = None
    time_to_first_token_ms: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost_usd: float | None = None
    status: str = "success"
    error_type: str | None = None
    error_message: str | None = None
    http_status_code: int | None = None
    input_preview: str | None = None
    output_preview: str | None = None
    is_streaming: bool = False
    stream_chunk_count: int | None = None
    stream_duration_ms: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id", "conversation_id", "message_id", mode="before")
    @classmethod
    def parse_uuid(cls, v: Any) -> uuid.UUID | None:
        if v is None or v == "":
            return None
        if isinstance(v, uuid.UUID):
            return v
        return uuid.UUID(str(v))

    @field_validator("request_timestamp", "response_timestamp", mode="before")
    @classmethod
    def parse_timestamp(cls, v: Any) -> datetime | None:
        if v is None or v == "":
            return None
        if isinstance(v, datetime):
            return v
        return datetime.fromisoformat(str(v))

    @field_validator("metadata", mode="before")
    @classmethod
    def parse_metadata(cls, v: Any) -> dict:
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    @field_validator("is_streaming", mode="before")
    @classmethod
    def parse_bool(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes")
        return bool(v)


@dataclass
class ProcessingResult:
    processed: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


def estimate_cost(
    provider: str, model: str, prompt_tokens: int | None, completion_tokens: int | None
) -> float | None:
    """Calculate estimated cost from token counts using the PRICING table."""
    pricing = PRICING.get((provider, model))
    if pricing is None:
        return None

    cost = 0.0
    if prompt_tokens:
        cost += prompt_tokens * pricing["input"]
    if completion_tokens:
        cost += completion_tokens * pricing["output"]
    return round(cost, 6) if cost > 0 else None


class ProcessingPipeline:
    """Processes batches of inference log messages: validate, redact PII, enrich, insert."""

    def __init__(
        self,
        db_session_factory: async_sessionmaker[AsyncSession],
        redactor: DeepRedactor | SimpleRedactor,
    ) -> None:
        self._db_session_factory = db_session_factory
        self._redactor = redactor

    async def process_batch(self, messages: list[dict]) -> ProcessingResult:
        result = ProcessingResult()
        valid_logs: list[dict[str, Any]] = []
        conversation_updates: dict[uuid.UUID, dict[str, Any]] = {}

        for raw in messages:
            try:
                # 1. Parse and validate
                log_data = InferenceLogData.model_validate(raw)

                # 2. Redact PII (skip if SDK already redacted — [REDACTED: markers present)
                if log_data.input_preview and "[REDACTED:" not in log_data.input_preview:
                    log_data.input_preview = self._redactor.redact(log_data.input_preview)
                if log_data.output_preview and "[REDACTED:" not in log_data.output_preview:
                    log_data.output_preview = self._redactor.redact(log_data.output_preview)

                # 3. Enrich: estimate cost if not already set
                if log_data.estimated_cost_usd is None:
                    log_data.estimated_cost_usd = estimate_cost(
                        log_data.provider,
                        log_data.model,
                        log_data.prompt_tokens,
                        log_data.completion_tokens,
                    )

                # 4. Prepare row for batch insert
                row = {
                    "conversation_id": log_data.conversation_id,
                    "message_id": log_data.message_id,
                    "session_id": log_data.session_id,
                    "provider": log_data.provider,
                    "model": log_data.model,
                    "request_timestamp": log_data.request_timestamp,
                    "response_timestamp": log_data.response_timestamp,
                    "latency_ms": log_data.latency_ms,
                    "time_to_first_token_ms": log_data.time_to_first_token_ms,
                    "prompt_tokens": log_data.prompt_tokens,
                    "completion_tokens": log_data.completion_tokens,
                    "total_tokens": log_data.total_tokens,
                    "estimated_cost_usd": log_data.estimated_cost_usd,
                    "status": log_data.status,
                    "error_type": log_data.error_type,
                    "error_message": log_data.error_message,
                    "http_status_code": log_data.http_status_code,
                    "input_preview": log_data.input_preview,
                    "output_preview": log_data.output_preview,
                    "is_streaming": log_data.is_streaming,
                    "stream_chunk_count": log_data.stream_chunk_count,
                    "stream_duration_ms": log_data.stream_duration_ms,
                    "metadata": log_data.metadata,
                }

                # Include explicit id only if provided
                if log_data.id is not None:
                    row["id"] = log_data.id

                valid_logs.append(row)

                # Track conversation counter updates
                if log_data.conversation_id is not None:
                    conv_id = log_data.conversation_id
                    if conv_id not in conversation_updates:
                        conversation_updates[conv_id] = {
                            "total_tokens": 0,
                            "message_count": 0,
                            "total_cost_usd": 0.0,
                        }
                    conversation_updates[conv_id]["total_tokens"] += (
                        log_data.total_tokens or 0
                    )
                    conversation_updates[conv_id]["message_count"] += 1
                    conversation_updates[conv_id]["total_cost_usd"] += (
                        log_data.estimated_cost_usd or 0.0
                    )

                result.processed += 1

            except Exception as exc:
                result.failed += 1
                result.errors.append(f"Validation error: {exc}")
                logger.warning("Failed to process message: %s", exc)

        # Batch INSERT and conversation updates inside a single session/transaction
        if valid_logs:
            async with self._db_session_factory() as session:
                async with session.begin():
                    # Batch insert using Core for performance
                    await session.execute(
                        InferenceLog.__table__.insert(),
                        valid_logs,
                    )

                    # Atomically update conversation counters
                    for conv_id, deltas in conversation_updates.items():
                        await session.execute(
                            text("""
                                UPDATE conversations
                                SET total_tokens = total_tokens + :tokens,
                                    message_count = message_count + :msgs,
                                    total_cost_usd = total_cost_usd + :cost,
                                    updated_at = now()
                                WHERE id = :conv_id
                            """),
                            {
                                "tokens": deltas["total_tokens"],
                                "msgs": deltas["message_count"],
                                "cost": round(deltas["total_cost_usd"], 6),
                                "conv_id": conv_id,
                            },
                        )

        return result
