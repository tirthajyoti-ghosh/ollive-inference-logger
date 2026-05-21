import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from src.api.router import api_router
from src.config import settings
from src.database import engine

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ollive Inference Logger",
    description="LLM inference logging, analytics, and chat API",
    version="0.1.0",
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers
app.include_router(api_router)


@app.on_event("startup")
async def startup():
    """Verify database and Redis connections on startup."""
    # Test DB connection
    try:
        async with engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        logger.info("Database connection verified")
    except Exception as e:
        logger.error("Database connection failed: %s", e)

    # Test Redis connection
    try:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        await redis.ping()
        await redis.aclose()
        logger.info("Redis connection verified")
    except Exception as e:
        logger.error("Redis connection failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready():
    """Deep health check — verifies DB and Redis are reachable."""
    checks = {}

    try:
        async with engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    try:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        await redis.ping()
        await redis.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
    }
