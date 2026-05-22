from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ollive:ollive_dev@localhost:5432/ollive"

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_db_scheme(cls, v: str) -> str:
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if "?sslmode=" in v:
            v = v.split("?")[0]
        return v

    @property
    def require_ssl(self) -> bool:
        raw = self.model_fields["database_url"].default
        env_url = __import__("os").environ.get("DATABASE_URL", raw)
        return "sslmode=" in env_url or ".render.com" in env_url
    redis_url: str = "redis://localhost:6379"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    ingest_api_key: str = ""
    ollive_ingest_endpoint: str = "http://localhost:8000/api/v1/ingest"
    pii_redaction_enabled: bool = True

    model_config = {"env_file": ".env"}


settings = Settings()
