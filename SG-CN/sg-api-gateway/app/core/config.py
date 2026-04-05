"""
核心配置模块 - 电信级配置管理
支持多环境、PDPA合规、中新链路配置
"""
from __future__ import annotations

import os
from typing import Annotated, Any
from functools import lru_cache

from pydantic import Field, field_validator, AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── 服务基础配置 ────────────────────────────────────────────────
    APP_NAME: str = "SG-API-Gateway"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="production", pattern="^(development|staging|production)$")
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4

    # ── TLS / HTTPS ─────────────────────────────────────────────────
    TLS_CERT_FILE: str = "/certs/server.crt"
    TLS_KEY_FILE: str = "/certs/server.key"
    TLS_CA_FILE: str | None = None  # mTLS 可选

    # ── Redis (限流、API Key缓存) ────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_SOCKET_TIMEOUT: float = 2.0
    REDIS_SOCKET_CONNECT_TIMEOUT: float = 2.0

    # ── 中新数据通道（重庆后端）─────────────────────────────────────
    CQ_BACKEND_PRIMARY: str = "https://cq-model-primary.internal:8443"
    CQ_BACKEND_STANDBY: str = "https://cq-model-standby.internal:8443"
    CQ_BACKEND_TIMEOUT: float = 60.0          # 推理任务可能耗时较长
    CQ_BACKEND_CONNECT_TIMEOUT: float = 5.0
    CQ_HEALTH_CHECK_INTERVAL: int = 30        # 秒
    CQ_HEALTH_CHECK_PATH: str = "/health"
    CQ_MAX_RETRIES: int = 3
    CQ_RETRY_WAIT_FIXED: float = 1.0
    CQ_CIRCUIT_BREAKER_THRESHOLD: int = 5     # 连续失败N次触发熔断
    CQ_CIRCUIT_BREAKER_TIMEOUT: int = 60      # 熔断恢复等待秒数

    # ── API Key 鉴权 ────────────────────────────────────────────────
    API_KEY_HEADER: str = "X-API-Key"
    API_KEY_MIN_LENGTH: int = 32
    API_KEY_HASH_ALGORITHM: str = "sha256"
    # 超级管理员 Key（用于管理接口，生产必须修改）
    ADMIN_API_KEY: str = Field(default="CHANGE_ME_IN_PRODUCTION_32CHARS__")

    # ── 限流 ────────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT_QPS: int = 10
    RATE_LIMIT_DEFAULT_BURST: int = 20
    RATE_LIMIT_DEFAULT_DAILY: int = 10000
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── PDPA 合规 ───────────────────────────────────────────────────
    # 禁止记录或转发的字段（最小必要原则）
    PDPA_BLOCKED_FIELDS: list[str] = Field(default=[
        "nric", "fin", "passport_no", "id_number",
        "full_name", "date_of_birth", "dob",
        "phone", "mobile", "telephone",
        "home_address", "residential_address",
        "bank_account", "credit_card", "cvv",
        "password", "secret", "token",
        "email",  # 非必要时屏蔽
    ])
    # 允许转发至重庆的字段白名单（空列表=全部允许）
    PDPA_FORWARD_WHITELIST: list[str] = Field(default=[])
    # 脱敏规则：字段名 -> 脱敏模式
    PDPA_MASK_PATTERNS: dict[str, str] = Field(default={
        "email": "partial",      # user@domain -> u***@domain
        "phone": "partial",      # 81234567 -> 8***4567
        "ip": "partial",         # 1.2.3.4 -> 1.2.*.*
    })

    # ── 日志 ────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"   # json | console
    LOG_FILE: str | None = "/var/log/sg-gateway/audit.log"
    AUDIT_LOG_FILE: str | None = "/var/log/sg-gateway/pdpa-audit.log"
    LOG_ROTATION_SIZE_MB: int = 100
    LOG_RETENTION_DAYS: int = 90   # PDPA建议至少保留3个月

    # ── 监控 ────────────────────────────────────────────────────────
    METRICS_ENABLED: bool = True
    METRICS_PATH: str = "/internal/metrics"
    HEALTH_PATH: str = "/health"

    # ── 安全 ────────────────────────────────────────────────────────
    ALLOWED_HOSTS: list[str] = Field(default=["*"])
    CORS_ORIGINS: list[str] = Field(default=[])
    MAX_REQUEST_SIZE_MB: int = 10
    REQUEST_TIMEOUT: float = 90.0

    @field_validator("ADMIN_API_KEY")
    @classmethod
    def validate_admin_key(cls, v: str) -> str:
        if v == "CHANGE_ME_IN_PRODUCTION_32CHARS__":
            import warnings
            warnings.warn(
                "⚠️  ADMIN_API_KEY is using default value. "
                "MUST be changed in production!",
                stacklevel=2,
            )
        if len(v) < 32:
            raise ValueError("ADMIN_API_KEY must be at least 32 characters")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
