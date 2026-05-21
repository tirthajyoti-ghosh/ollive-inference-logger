import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.worker.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="active",
    )
    message_count: Mapped[int] = mapped_column(Integer, server_default="0")
    total_tokens: Mapped[int] = mapped_column(Integer, server_default="0")
    total_cost_usd: Mapped[float] = mapped_column(
        Numeric(10, 6), server_default="0"
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        onupdate=datetime.utcnow,
        nullable=False,
    )

    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )
    inference_logs = relationship(
        "InferenceLog", back_populates="conversation"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'paused', 'completed', 'cancelled', 'error')",
            name="ck_conversations_status",
        ),
        Index("ix_conversations_status", "status"),
        Index("ix_conversations_created_at", "created_at", postgresql_using="btree"),
        Index("ix_conversations_provider", "provider"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'assistant', 'system')",
            name="ck_messages_role",
        ),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )


class InferenceLog(Base):
    __tablename__ = "inference_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    session_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    request_timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    response_timestamp: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_to_first_token_ms: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[float | None] = mapped_column(
        Numeric(10, 6), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="success"
    )
    error_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    http_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_streaming: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false")
    )
    stream_chunk_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    stream_duration_ms: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    conversation = relationship("Conversation", back_populates="inference_logs")
    message = relationship("Message")

    __table_args__ = (
        CheckConstraint(
            "status IN ('success', 'error', 'timeout', 'cancelled', 'rate_limited')",
            name="ck_inference_logs_status",
        ),
        Index(
            "ix_inference_logs_created_at",
            "created_at",
            postgresql_using="btree",
        ),
        Index(
            "ix_inference_logs_provider_model",
            "provider",
            "model",
        ),
        Index("ix_inference_logs_status", "status"),
        Index("ix_inference_logs_conversation_id", "conversation_id"),
        Index("ix_inference_logs_session_id", "session_id"),
        Index(
            "ix_inference_logs_success_latency",
            "created_at",
            "latency_ms",
            postgresql_where=text("status = 'success'"),
        ),
    )
