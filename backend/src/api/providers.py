from fastapi import APIRouter

from src.config import settings
from src.services.llm_providers import PROVIDER_MODELS

router = APIRouter(prefix="/providers", tags=["providers"])

_KEY_MAP = {
    "openai": "openai_api_key",
    "anthropic": "anthropic_api_key",
    "groq": "groq_api_key",
    "gemini": "gemini_api_key",
}


@router.get("")
async def list_providers():
    """List available LLM providers and their models."""
    configured = [
        p for p in PROVIDER_MODELS
        if getattr(settings, _KEY_MAP.get(p, ""), "")
    ]
    return {"providers": PROVIDER_MODELS, "configured": configured}
