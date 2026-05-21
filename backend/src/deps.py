from collections.abc import AsyncGenerator

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.services.chat_service import ChatService
from src.services.dashboard_service import DashboardService
from src.services.llm_providers import LLMService

_redis_client: Redis | None = None
_llm_service: LLMService | None = None


async def get_redis() -> AsyncGenerator[Redis, None]:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.redis_url, decode_responses=True
        )
    yield _redis_client


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


async def get_chat_service(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    llm_service: LLMService = Depends(get_llm_service),
) -> ChatService:
    return ChatService(db=db, redis=redis, llm_service=llm_service)


async def get_dashboard_service(
    db: AsyncSession = Depends(get_db),
) -> DashboardService:
    return DashboardService(db=db)
