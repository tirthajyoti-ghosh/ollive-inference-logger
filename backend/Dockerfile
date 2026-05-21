FROM python:3.12-slim

WORKDIR /app

# Install dependencies using pre-built wheels (no build-essential needed)
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    "asyncpg>=0.30.0" \
    "alembic>=1.14.0" \
    "pydantic>=2.0.0" \
    "pydantic-settings>=2.0.0" \
    "redis>=5.0.0" \
    "litellm>=1.50.0" \
    "httpx>=0.27.0"

ENV PYTHONPATH=/app

COPY alembic.ini .
COPY alembic/ alembic/
COPY src/ src/
COPY scripts/ scripts/

RUN useradd -m appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
