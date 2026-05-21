from fastapi import APIRouter

from src.services.llm_providers import PROVIDER_MODELS

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("")
async def list_providers():
    """List available LLM providers and their models."""
    return {"providers": PROVIDER_MODELS}
