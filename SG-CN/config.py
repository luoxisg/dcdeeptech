"""
config.py — Gateway configuration via environment variables.
Loaded once at startup using python-dotenv + Pydantic BaseSettings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Gateway identity
    gateway_api_key: str
    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8000

    # Upstream (China-side inference backend)
    sophnet_api_url: str  # e.g. https://your-china-endpoint
    sophnet_api_key: str
    sophnet_auth_mode: str = "bearer"  # "bearer" | "none"

    # Defaults
    default_model: str = "qwenvl"
    request_timeout: float = 60.0


settings = Settings()  # type: ignore[call-arg]
