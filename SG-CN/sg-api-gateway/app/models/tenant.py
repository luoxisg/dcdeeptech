"""
租户与 API Key 数据模型
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RateLimitPolicy(BaseModel):
    qps: int = 10
    burst: int = 20
    daily_quota: int = 10_000
    concurrent_max: int = 50

    def model_post_init(self, __context: Any) -> None:
        if self.burst < self.qps:
            self.burst = self.qps * 2


class APIKeyRecord(BaseModel):
    """API Key 元数据记录（存入 Redis）"""
    tenant_id: str
    project_id: str
    scope: str = "write"
    active: bool = True
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    expires_at: str | None = None
    description: str = ""
    rate_limit_policy: RateLimitPolicy = Field(default_factory=RateLimitPolicy)
    # 允许该租户调用的后端路径前缀白名单（空=全部）
    allowed_paths: list[str] = Field(default_factory=list)

    @field_validator("rate_limit_policy", mode="before")
    @classmethod
    def parse_rate_limit(cls, v: Any) -> RateLimitPolicy:
        if isinstance(v, str):
            import json
            return RateLimitPolicy(**json.loads(v))
        if isinstance(v, dict):
            return RateLimitPolicy(**v)
        return v

    @field_validator("active", mode="before")
    @classmethod
    def parse_bool(cls, v: Any) -> bool:
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes")
        return bool(v)

    @field_validator("allowed_paths", mode="before")
    @classmethod
    def parse_paths(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []


class TenantConfig(BaseModel):
    """租户配置"""
    tenant_id: str
    tenant_name: str
    contact_email: str = ""
    pdpa_consent: bool = False
    pdpa_consent_date: str | None = None
    allowed_forwarding_fields: list[str] = Field(default_factory=list)
    blocked_forwarding_fields: list[str] = Field(default_factory=list)
    active: bool = True


# ── 管理接口请求/响应模型 ─────────────────────────────────────────

class CreateAPIKeyRequest(BaseModel):
    tenant_id: str = Field(..., min_length=3, max_length=64)
    project_id: str = Field(..., min_length=3, max_length=64)
    scope: str = Field(default="write", pattern="^(read|write|admin)$")
    description: str = Field(default="", max_length=256)
    rate_limit_qps: int = Field(default=10, ge=1, le=1000)
    rate_limit_daily: int = Field(default=10_000, ge=100, le=10_000_000)
    allowed_paths: list[str] = Field(default_factory=list)


class CreateAPIKeyResponse(BaseModel):
    api_key: str          # 仅在创建时返回一次，之后不可再查
    key_hash_prefix: str  # 哈希前8位，用于标识
    tenant_id: str
    project_id: str
    created_at: str
    message: str = "Store this key securely. It will not be shown again."


class RevokeAPIKeyRequest(BaseModel):
    api_key: str


class GatewayProxyRequest(BaseModel):
    """转发至重庆后端的请求体（通用结构）"""
    path: str = Field(..., description="后端接口路径，如 /v1/chat/completions")
    method: str = Field(default="POST", pattern="^(GET|POST|PUT|DELETE|PATCH)$")
    payload: dict[str, Any] = Field(default_factory=dict)
    headers_passthrough: dict[str, str] = Field(default_factory=dict)
    timeout_override: float | None = Field(default=None, ge=1.0, le=300.0)
