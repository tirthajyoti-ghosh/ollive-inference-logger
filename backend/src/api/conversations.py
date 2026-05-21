import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models.conversation import Conversation
from src.schemas.conversation import (
    ConversationCreate,
    ConversationList,
    ConversationResponse,
    ConversationUpdate,
)
from src.schemas.message import MessageResponse

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=ConversationList)
async def list_conversations(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Conversation)
    count_query = select(func.count()).select_from(Conversation)

    if status:
        query = query.where(Conversation.status == status)
        count_query = count_query.where(Conversation.status == status)

    query = query.order_by(Conversation.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    conversations = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return ConversationList(
        items=[ConversationResponse.model_validate(c) for c in conversations],
        total=total,
    )


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
):
    conversation = Conversation(
        provider=data.provider,
        model=data.model,
        title=data.title,
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv_data = ConversationResponse.model_validate(conversation)
    messages = [
        MessageResponse.model_validate(m)
        for m in sorted(conversation.messages, key=lambda m: m.created_at)
    ]
    return {
        **conv_data.model_dump(),
        "messages": [m.model_dump() for m in messages],
    }


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: uuid.UUID,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if data.status is not None:
        valid_transitions = {
            "active": {"paused", "completed", "cancelled"},
            "paused": {"active", "cancelled"},
        }
        allowed = valid_transitions.get(conversation.status, set())
        if data.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{conversation.status}' to '{data.status}'",
            )
        conversation.status = data.status

    if data.title is not None:
        conversation.title = data.title

    await db.flush()
    await db.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
