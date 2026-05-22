import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.deps import get_chat_service
from src.models.conversation import Conversation
from src.schemas.message import ChatRequest, MessageResponse
from src.services.chat_service import ChatService

router = APIRouter(prefix="/conversations/{conversation_id}", tags=["chat"])


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

    # Verify conversation exists
    result = await chat_service.db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    await chat_service.save_message(conversation_id, "user", data.content)

    # Get context
    context = await chat_service.get_context_messages(conversation_id)

    async def event_generator():
        full_content = ""
        chunk_count = 0
        request_ts = datetime.now(timezone.utc)
        first_token_ts = None
        cancelled = False

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

            # Save assistant message
            assistant_msg = await chat_service.save_message(
                conversation_id,
                "assistant",
                full_content,
            )
            await chat_service.db.commit()

            # Estimate tokens from content length (rough: 1 token ≈ 4 chars)
            est_in_tokens = len(data.content) // 4
            est_out_tokens = len(full_content) // 4
            est_total = est_in_tokens + est_out_tokens

            from decimal import Decimal
            est_cost = Decimal(str(round((est_in_tokens * 3 + est_out_tokens * 15) / 1_000_000, 6)))

            # Update conversation totals directly so header refresh sees them
            await chat_service.update_conversation_tokens(
                conversation_id, est_total, est_cost
            )
            await chat_service.db.commit()

            # Auto-generate title on first exchange (2 messages = user + assistant)
            conv_messages = await chat_service.get_context_messages(conversation_id)
            if len(conv_messages) == 2 and not conversation.title:
                try:
                    title_resp = await chat_service.llm_service.complete(
                        messages=[
                            {"role": "system", "content": "Generate a short title (max 6 words) for this conversation. Reply with ONLY the title, no quotes or punctuation."},
                            {"role": "user", "content": data.content},
                            {"role": "assistant", "content": full_content[:500]},
                            {"role": "user", "content": "Title:"},
                        ],
                        provider=conversation.provider,
                        model=conversation.model,
                    )
                    title = title_resp.content.strip().strip('"').strip("'")[:80]
                    if title:
                        from sqlalchemy import update as sql_update
                        await chat_service.db.execute(
                            sql_update(Conversation)
                            .where(Conversation.id == conversation_id)
                            .values(title=title)
                        )
                        await chat_service.db.commit()
                except Exception:
                    pass

            # Send final event with stats
            yield f"data: {json.dumps({'done': True, 'message_id': str(assistant_msg.id), 'latency_ms': stream_duration_ms, 'tokens_in': est_in_tokens, 'tokens_out': est_out_tokens, 'cost': float(est_cost)})}\n\n"

            # Log inference asynchronously via Redis
            from src.services.llm_providers import LLMResponse

            llm_response = LLMResponse(
                content=full_content,
                prompt_tokens=est_in_tokens,
                completion_tokens=est_out_tokens,
                total_tokens=est_total,
                model=conversation.model,
                provider=conversation.provider,
            )

            ttft_ms = (
                int((first_token_ts - request_ts).total_seconds() * 1000)
                if first_token_ts is not None
                else None
            )

            await chat_service.log_inference(
                conversation_id=conversation_id,
                message_id=assistant_msg.id,
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
