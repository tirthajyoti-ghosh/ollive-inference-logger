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

        try:
            async for kind, token in chat_service.llm_service.stream(
                messages=context,
                provider=conversation.provider,
                model=conversation.model,
            ):
                if await request.is_disconnected():
                    break

                if kind == "thinking":
                    yield f"data: {json.dumps({'thinking': token})}\n\n"
                else:
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

            # Send final event
            yield f"data: {json.dumps({'done': True, 'message_id': str(assistant_msg.id)})}\n\n"

            # Log inference asynchronously via Redis
            from src.services.llm_providers import LLMResponse

            llm_response = LLMResponse(
                content=full_content,
                prompt_tokens=0,  # Not available in streaming
                completion_tokens=0,
                total_tokens=0,
                model=conversation.model,
                provider=conversation.provider,
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
                input_preview=data.content[:500],
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
