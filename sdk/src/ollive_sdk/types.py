"""Data types for Ollive inference logging."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class InferenceStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    RATE_LIMITED = "rate_limited"


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class InferenceLog(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    conversation_id: Optional[UUID] = None
    message_id: Optional[UUID] = None
    session_id: Optional[str] = None
    provider: str
    model: str
    request_timestamp: datetime
    response_timestamp: Optional[datetime] = None
    latency_ms: Optional[int] = None
    time_to_first_token_ms: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    estimated_cost_usd: Optional[float] = None
    status: InferenceStatus = InferenceStatus.SUCCESS
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    http_status_code: Optional[int] = None
    input_preview: Optional[str] = None
    output_preview: Optional[str] = None
    is_streaming: bool = False
    stream_chunk_count: Optional[int] = None
    stream_duration_ms: Optional[int] = None
    metadata: dict = Field(default_factory=dict)
