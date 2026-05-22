import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db, async_session_factory
from src.deps import get_chat_service, get_llm_service
from src.models.conversation import Conversation
from src.schemas.message import ChatRequest, MessageResponse
from src.services.chat_service import ChatService
from src.services.llm_providers import LLMResponse, LLMService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations/{conversation_id}", tags=["chat"])


async def _generate_title(
    conversation_id: uuid.UUID,
    provider: str,
    model: str,
    user_content: str,
    assistant_content: str,
    llm_service: LLMService,
):
    """Background task: generate a title for the conversation after first exchange."""
    try:
        title_resp = await llm_service.complete(
            messages=[
                {"role": "system", "content": "Generate a short title (max 6 words) for this conversation. Reply with ONLY the title, no quotes or punctuation."},
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": assistant_content[:500]},
                {"role": "user", "content": "Title:"},
            ],
            provider=provider,
            model=model,
        )
        title = title_resp.content.strip().strip('"').strip("'")[:80]
        if title:
            async with async_session_factory() as session:
                await session.execute(
                    sql_update(Conversation)
                    .where(Conversation.id == conversation_id)
                    .values(title=title)
                )
                await session.commit()
            logger.info("Generated title for %s: %s", conversation_id, title)
    except Exception:
        logger.exception("Title generation failed for %s", conversation_id)


@router.post("/chat", response_model=MessageResponse)
async def chat(
    conversation_id: uuid.UUID,
    data: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
):
    """Non-streaming chat endpoint."""
    try:
        assistant_msg, llm_response = await chat_service.chat(
            conversation_id=conversation_id,
            content=data.content,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse.model_validate(assistant_msg)


@router.post("/chat/stream")
async def chat_stream(
    conversation_id: uuid.UUID,
    data: ChatRequest,
    request: Request,
    chat_service: ChatService = Depends(get_chat_service),
):
    """SSE streaming chat endpoint."""

    result = await chat_service.db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await chat_service.save_message(conversation_id, "user", data.content)
    context = await chat_service.get_context_messages(conversation_id)

    async def event_generator():
        full_content = ""
        chunk_count = 0
        request_ts = datetime.now(timezone.utc)
        first_token_ts = None
        cancelled = False
        real_usage: dict | None = None

        try:
            async for kind, token in chat_service.llm_service.stream(
                messages=context,
                provider=conversation.provider,
                model=conversation.model,
            ):
                if await request.is_disconnected():
                    cancelled = True
                    break

                if kind == "thinking":
                    yield f"data: {json.dumps({'thinking': token})}\n\n"
                elif kind == "usage":
                    parts = token.split(",")
                    if len(parts) == 3:
                        real_usage = {
                            "prompt_tokens": int(parts[0]),
                            "completion_tokens": int(parts[1]),
                            "total_tokens": int(parts[2]),
                        }
                else:
                    if first_token_ts is None:
                        first_token_ts = datetime.now(timezone.utc)
                    full_content += token
                    chunk_count += 1
                    yield f"data: {json.dumps({'token': token})}\n\n"

            response_ts = datetime.now(timezone.utc)
            stream_duration_ms = int(
                (response_ts - request_ts).total_seconds() * 1000
            )
            ttft_ms = int((first_token_ts - request_ts).total_seconds() * 1000) if first_token_ts else None

            if real_usage:
                in_tokens = real_usage["prompt_tokens"]
                out_tokens = real_usage["completion_tokens"]
                total_tokens = real_usage["total_tokens"]
            else:
                in_tokens = len(data.content) // 4
                out_tokens = len(full_content) // 4
                total_tokens = in_tokens + out_tokens

            from decimal import Decimal
            est_cost = Decimal(str(round((in_tokens * 3 + out_tokens * 15) / 1_000_000, 6)))

            assistant_msg_id = None

            if cancelled:
                yield f"data: {json.dumps({'done': True, 'message_id': '', 'latency_ms': stream_duration_ms, 'tokens_in': in_tokens, 'tokens_out': out_tokens, 'cost': float(est_cost)})}\n\n"
            else:
                assistant_msg = await chat_service.save_message(
                    conversation_id, "assistant", full_content,
                )
                assistant_msg_id = assistant_msg.id
                await chat_service.db.commit()

                await chat_service.update_conversation_tokens(
                    conversation_id, total_tokens, est_cost
                )
                await chat_service.db.commit()

                # Title generation — fire-and-forget background task
                conv_messages = await chat_service.get_context_messages(conversation_id)
                if len(conv_messages) == 2 and not conversation.title:
                    asyncio.create_task(_generate_title(
                        conversation_id=conversation_id,
                        provider=conversation.provider,
                        model=conversation.model,
                        user_content=data.content,
                        assistant_content=full_content,
                        llm_service=chat_service.llm_service,
                    ))

                yield f"data: {json.dumps({'done': True, 'message_id': str(assistant_msg_id), 'latency_ms': stream_duration_ms, 'tokens_in': in_tokens, 'tokens_out': out_tokens, 'cost': float(est_cost)})}\n\n"

            llm_response = LLMResponse(
                content=full_content,
                prompt_tokens=in_tokens,
                completion_tokens=out_tokens,
                total_tokens=total_tokens,
                model=conversation.model,
                provider=conversation.provider,
            )

            await chat_service.log_inference(
                conversation_id=conversation_id,
                message_id=assistant_msg_id,
                provider=conversation.provider,
                model=conversation.model,
                llm_response=llm_response,
                request_ts=request_ts,
                response_ts=response_ts,
                is_streaming=True,
                stream_chunk_count=chunk_count,
                stream_duration_ms=stream_duration_ms,
                time_to_first_token_ms=ttft_ms,
                input_preview=data.content[:500],
                status="cancelled" if cancelled else "success",
            )

        except Exception as e:
            response_ts = datetime.now(timezone.utc)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

            await chat_service.log_inference_error(
                conversation_id=conversation_id,
                provider=conversation.provider,
                model=conversation.model,
                request_ts=request_ts,
                error_type=type(e).__name__,
                error_message=str(e),
                input_preview=data.content[:500],
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/cancel")
async def cancel_stream(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Explicit cancel endpoint. Marks the conversation as paused so the
    frontend can display the correct state. The actual stream abort is
    driven by the client closing the SSE connection (AbortController)."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status == "active":
        await db.execute(
            sql_update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(status="paused")
        )

    return {"status": "cancelled", "conversation_id": str(conversation_id)}
