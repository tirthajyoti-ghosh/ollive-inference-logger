import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InferenceLogCreate(BaseModel):
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
    metadata_: dict = Field(default_factory=dict, validation_alias="metadata")


class InferenceLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID | None
    message_id: uuid.UUID | None
    session_id: str | None
    provider: str
    model: str
    request_timestamp: datetime
    response_timestamp: datetime | None
    latency_ms: int | None
    time_to_first_token_ms: int | None
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    estimated_cost_usd: float | None
    status: str
    error_type: str | None
    error_message: str | None
    http_status_code: int | None
    input_preview: str | None
    output_preview: str | None
    is_streaming: bool
    stream_chunk_count: int | None
    stream_duration_ms: int | None
    metadata_: dict
    created_at: datetime
