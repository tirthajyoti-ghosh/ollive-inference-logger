import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    provider: str
    model: str
    title: str | None = None


class ConversationUpdate(BaseModel):
    status: str | None = None
    title: str | None = None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    title: str | None
    provider: str
    model: str
    status: str
    message_count: int
    total_tokens: int
    total_cost_usd: float
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime
    updated_at: datetime


class ConversationList(BaseModel):
    items: list[ConversationResponse]
    total: int
