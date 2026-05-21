FROM python:3.12-slim

WORKDIR /app

# Install dependencies using pre-built wheels (no build-essential needed)
RUN pip install --no-cache-dir \
    "redis>=5.0.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    "asyncpg>=0.30.0" \
    "pydantic>=2.0.0" \
    "pydantic-settings>=2.0.0" \
    "presidio-analyzer>=2.2.0" \
    "presidio-anonymizer>=2.2.0" \
    "aiohttp>=3.9.0"

# Download spacy model for Presidio NER (fall back to regex if unavailable)
RUN python -m spacy download en_core_web_sm 2>/dev/null || true

COPY src/ src/

RUN useradd -m appuser
USER appuser

EXPOSE 8080

CMD ["python", "-m", "src.worker.main"]
