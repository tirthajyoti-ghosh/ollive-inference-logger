from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ollive:ollive_dev@localhost:5432/ollive"
    redis_url: str = "redis://localhost:6379"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    ollive_ingest_endpoint: str = "http://localhost:8000/api/v1/ingest"
    pii_redaction_enabled: bool = True

    model_config = {"env_file": ".env"}


settings = Settings()
