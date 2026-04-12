from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "China Outbound Enterprise Lead Intelligence Platform API"
    database_url: str = "sqlite:///./lead_intel.db"
    redis_url: str = "redis://localhost:6379/0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3002"
    llm_mode: str = "mock"

    model_config = SettingsConfigDict(env_prefix="LEAD_INTEL_", env_file=".env", extra="ignore")


settings = Settings()
