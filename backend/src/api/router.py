from fastapi import APIRouter

from src.api.chat import router as chat_router
from src.api.conversations import router as conversations_router
from src.api.dashboard import router as dashboard_router
from src.api.ingest import router as ingest_router
from src.api.providers import router as providers_router

api_router = APIRouter()

api_router.include_router(conversations_router)
api_router.include_router(chat_router)
api_router.include_router(ingest_router)
api_router.include_router(dashboard_router)
api_router.include_router(providers_router)
