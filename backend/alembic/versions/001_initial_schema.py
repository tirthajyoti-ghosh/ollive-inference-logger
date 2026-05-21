"""Initial schema — conversations, messages, inference_logs

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- conversations ---
    op.create_table(
        "conversations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
        ),
        sa.Column("message_count", sa.Integer, server_default="0"),
        sa.Column("total_tokens", sa.Integer, server_default="0"),
        sa.Column(
            "total_cost_usd", sa.Numeric(10, 6), server_default="0"
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'paused', 'completed', 'cancelled', 'error')",
            name="ck_conversations_status",
        ),
    )
    op.create_index("ix_conversations_status", "conversations", ["status"])
    op.create_index(
        "ix_conversations_created_at", "conversations", ["created_at"]
    )
    op.create_index(
        "ix_conversations_provider", "conversations", ["provider"]
    )

    # --- messages ---
    op.create_table(
        "messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("token_count", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('user', 'assistant', 'system')",
            name="ck_messages_role",
        ),
    )
    op.create_index(
        "ix_messages_conversation_created",
        "messages",
        ["conversation_id", "created_at"],
    )

    # --- inference_logs ---
    op.create_table(
        "inference_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("session_id", sa.String(100), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column(
            "request_timestamp",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "response_timestamp",
            postgresql.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("time_to_first_token_ms", sa.Integer, nullable=True),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("total_tokens", sa.Integer, nullable=True),
        sa.Column(
            "estimated_cost_usd", sa.Numeric(10, 6), nullable=True
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="success",
        ),
        sa.Column("error_type", sa.String(100), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("http_status_code", sa.Integer, nullable=True),
        sa.Column("input_preview", sa.Text, nullable=True),
        sa.Column("output_preview", sa.Text, nullable=True),
        sa.Column(
            "is_streaming",
            sa.Boolean,
            server_default=sa.text("false"),
        ),
        sa.Column("stream_chunk_count", sa.Integer, nullable=True),
        sa.Column("stream_duration_ms", sa.Integer, nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('success', 'error', 'timeout', 'cancelled', 'rate_limited')",
            name="ck_inference_logs_status",
        ),
    )
    op.create_index(
        "ix_inference_logs_created_at", "inference_logs", ["created_at"]
    )
    op.create_index(
        "ix_inference_logs_provider_model",
        "inference_logs",
        ["provider", "model"],
    )
    op.create_index(
        "ix_inference_logs_status", "inference_logs", ["status"]
    )
    op.create_index(
        "ix_inference_logs_conversation_id",
        "inference_logs",
        ["conversation_id"],
    )
    op.create_index(
        "ix_inference_logs_session_id", "inference_logs", ["session_id"]
    )
    # Partial index: only for successful requests
    op.create_index(
        "ix_inference_logs_success_latency",
        "inference_logs",
        ["created_at", "latency_ms"],
        postgresql_where=sa.text("status = 'success'"),
    )

    # --- Materialized view: hourly inference stats ---
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS inference_stats_hourly AS
        SELECT
            date_trunc('hour', created_at) AS hour,
            provider,
            model,
            COUNT(*)                                                  AS request_count,
            COUNT(*) FILTER (WHERE status = 'success')                AS success_count,
            COUNT(*) FILTER (WHERE status != 'success')               AS error_count,
            AVG(latency_ms) FILTER (WHERE status = 'success')         AS avg_latency_ms,
            percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)
                FILTER (WHERE status = 'success')                     AS p50_latency_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
                FILTER (WHERE status = 'success')                     AS p95_latency_ms,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)
                FILTER (WHERE status = 'success')                     AS p99_latency_ms,
            SUM(total_tokens)                                         AS total_tokens,
            SUM(prompt_tokens)                                        AS total_prompt_tokens,
            SUM(completion_tokens)                                    AS total_completion_tokens,
            SUM(estimated_cost_usd)                                   AS total_cost_usd
        FROM inference_logs
        GROUP BY hour, provider, model
        ORDER BY hour DESC
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_inference_stats_hourly_pk
        ON inference_stats_hourly (hour, provider, model)
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS inference_stats_hourly")
    op.drop_table("inference_logs")
    op.drop_table("messages")
    op.drop_table("conversations")
