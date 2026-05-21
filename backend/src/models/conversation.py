import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


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
