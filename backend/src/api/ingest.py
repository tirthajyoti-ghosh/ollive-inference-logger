import json

from fastapi import APIRouter, Depends, Header, HTTPException
from redis.asyncio import Redis

from src.config import settings
from src.deps import get_redis
from src.schemas.inference_log import InferenceLogCreate

router = APIRouter(prefix="/api/v1", tags=["ingest"])


async def verify_ingest_key(x_ollive_api_key: str | None = Header(None)):
    expected = getattr(settings, "ingest_api_key", "")
    if expected and x_ollive_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Ollive-API-Key")


@router.post("/ingest", status_code=202, dependencies=[Depends(verify_ingest_key)])
async def ingest_logs(
    logs: list[InferenceLogCreate],
    redis: Redis = Depends(get_redis),
):
    """Accept inference logs from SDKs and publish to Redis Streams."""
    published = 0
    for log in logs:
        log_data = {}
        for key, value in log.model_dump().items():
            if value is None:
                continue
            if isinstance(value, dict):
                log_data[key] = json.dumps(value)
            else:
                log_data[key] = str(value)

        await redis.xadd("inference:logs", log_data)
        published += 1

    return {"accepted": published}
