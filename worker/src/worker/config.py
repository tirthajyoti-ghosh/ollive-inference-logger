from pydantic_settings import BaseSettings


class WorkerSettings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ollive:ollive_dev@localhost:5432/ollive"
    redis_url: str = "redis://localhost:6379"
    pii_redaction_enabled: bool = True
    consumer_group: str = "ingestion-workers"
    stream_name: str = "inference:logs"
    batch_size: int = 100
    block_ms: int = 5000
    dead_letter_stream: str = "inference:logs:dead"
    max_retries: int = 3
    matview_refresh_interval_s: int = 300  # 5 minutes

    model_config = {"env_file": ".env"}


settings = WorkerSettings()
