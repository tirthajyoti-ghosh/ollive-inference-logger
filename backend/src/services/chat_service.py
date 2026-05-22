import json
import uuid
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.conversation import Conversation
from src.models.inference_log import InferenceLog
from src.models.message import Message
from src.services.llm_providers import LLMResponse, LLMService

MAX_CONTEXT_MESSAGES = 20


class ChatService:
    """Orchestrates chat interactions: context management, LLM calls, logging."""

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        llm_service: LLMService,
    ):
        self.db = db
        self.redis = redis
        self.llm_service = llm_service

    async def get_context_messages(
        self, conversation_id: uuid.UUID
    ) -> list[dict[str, str]]:
        """Fetch the last N messages for the conversation as LLM context."""
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(MAX_CONTEXT_MESSAGES)
        )
        messages = list(reversed(result.scalars().all()))
        return [{"role": m.role, "content": m.content} for m in messages]

    async def save_message(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        token_count: int | None = None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            token_count=token_count,
        )
        self.db.add(message)

        # Increment message count on conversation
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(message_count=Conversation.message_count + 1)
        )
        await self.db.flush()
        return message

    async def update_conversation_tokens(
        self,
        conversation_id: uuid.UUID,
        tokens: int,
        cost: float,
    ) -> None:
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(
                total_tokens=Conversation.total_tokens + tokens,
                total_cost_usd=Conversation.total_cost_usd + cost,
            )
        )

    async def log_inference(
        self,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID | None,
        provider: str,
        model: str,
        llm_response: LLMResponse,
        request_ts: datetime,
        response_ts: datetime,
        is_streaming: bool = False,
        stream_chunk_count: int | None = None,
        stream_duration_ms: int | None = None,
        time_to_first_token_ms: int | None = None,
        input_preview: str | None = None,
        status: str = "success",
    ) -> None:
        """Publish inference log to Redis Streams for async persistence."""
        latency_ms = int(
            (response_ts - request_ts).total_seconds() * 1000
        )

        log_data = {
            "conversation_id": str(conversation_id),
            "message_id": str(message_id) if message_id else "",
            "provider": provider,
            "model": model,
            "request_timestamp": request_ts.isoformat(),
            "response_timestamp": response_ts.isoformat(),
            "latency_ms": str(latency_ms),
            "prompt_tokens": str(llm_response.prompt_tokens),
            "completion_tokens": str(llm_response.completion_tokens),
            "total_tokens": str(llm_response.total_tokens),
            "status": status,
            "is_streaming": str(is_streaming).lower(),
            "input_preview": (input_preview or "")[:500],
            "output_preview": (llm_response.content or "")[:500],
        }

        if stream_chunk_count is not None:
            log_data["stream_chunk_count"] = str(stream_chunk_count)
        if stream_duration_ms is not None:
            log_data["stream_duration_ms"] = str(stream_duration_ms)
        if time_to_first_token_ms is not None:
            log_data["time_to_first_token_ms"] = str(time_to_first_token_ms)

        try:
            await self.redis.xadd("inference:logs", log_data)
        except Exception:
            # Non-blocking — don't fail the chat response if Redis is down
            pass

    async def log_inference_error(
        self,
        conversation_id: uuid.UUID,
        provider: str,
        model: str,
        request_ts: datetime,
        error_type: str,
        error_message: str,
        input_preview: str | None = None,
    ) -> None:
        """Publish an error inference log to Redis Streams."""
        now = datetime.now(timezone.utc)
        latency_ms = int((now - request_ts).total_seconds() * 1000)

        log_data = {
            "conversation_id": str(conversation_id),
            "provider": provider,
            "model": model,
            "request_timestamp": request_ts.isoformat(),
            "response_timestamp": now.isoformat(),
            "latency_ms": str(latency_ms),
            "status": "error",
            "error_type": error_type,
            "error_message": error_message[:1000],
            "input_preview": (input_preview or "")[:500],
        }

        try:
            await self.redis.xadd("inference:logs", log_data)
        except Exception:
            pass

    async def chat(
        self, conversation_id: uuid.UUID, content: str
    ) -> tuple[Message, LLMResponse]:
        """Non-streaming chat: save user msg, call LLM, save assistant msg, log."""
        # Get conversation for provider/model
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one()

        # Save user message
        await self.save_message(conversation_id, "user", content)

        # Build context
        context = await self.get_context_messages(conversation_id)

        # Call LLM
        request_ts = datetime.now(timezone.utc)
        llm_response = await self.llm_service.complete(
            messages=context,
            provider=conversation.provider,
            model=conversation.model,
        )
        response_ts = datetime.now(timezone.utc)

        # Save assistant message
        assistant_msg = await self.save_message(
            conversation_id,
            "assistant",
            llm_response.content,
            token_count=llm_response.completion_tokens,
        )

        # Update conversation token totals
        await self.update_conversation_tokens(
            conversation_id,
            llm_response.total_tokens,
            0,  # Cost calculation would go here
        )

        await self.db.commit()

        # Log inference asynchronously
        await self.log_inference(
            conversation_id=conversation_id,
            message_id=assistant_msg.id,
            provider=conversation.provider,
            model=conversation.model,
            llm_response=llm_response,
            request_ts=request_ts,
            response_ts=response_ts,
            input_preview=content[:500],
        )

        return assistant_msg, llm_response
