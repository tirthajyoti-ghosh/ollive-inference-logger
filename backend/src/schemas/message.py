import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MessageCreate(BaseModel):
    content: str


class ChatRequest(BaseModel):
    content: str
    provider: str
    model: str


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    token_count: int | None
    created_at: datetime
