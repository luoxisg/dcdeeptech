"""
管理接口 & 健康检查接口
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import ORJSONResponse

from app.core.auth import APIKeyStore, generate_api_key, require_admin
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.tenant import (
    APIKeyRecord,
    CreateAPIKeyRequest,
    CreateAPIKeyResponse,
    RateLimitPolicy,
    RevokeAPIKeyRequest,
)
from app.services.cq_forwarder import cq_service

settings = get_settings()
logger = get_logger(__name__)

# ── 健康检查（公开，无需鉴权）────────────────────────────────────
health_router = APIRouter(tags=["Health"])


@health_router.get("/health", summary="服务健康检查")
async def health_check() -> ORJSONResponse:
    """
    返回服务整体健康状态：
    - Gateway 自身状态
    - 重庆后端链路状态（主/备）
    """
    backend_status = cq_service.get_status()
    overall = "healthy" if backend_status["any_available"] else "degraded"
    
    return ORJSONResponse(
        content={
            "status": overall,
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "backend": backend_status,
        },
        status_code=200 if overall == "healthy" else 207,
    )


@health_router.get("/health/ready", summary="就绪检查（Kubernetes readiness probe）")
async def readiness_check() -> ORJSONResponse:
    backend_status = cq_service.get_status()
    ready = backend_status["any_available"]
    return ORJSONResponse(
        content={"ready": ready},
        status_code=200 if ready else 503,
    )


@health_router.get("/health/live", summary="存活检查（Kubernetes liveness probe）")
async def liveness_check() -> ORJSONResponse:
    return ORJSONResponse(content={"alive": True}, status_code=200)


# ── 管理接口（需要 Admin Key）──────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.post(
    "/keys",
    summary="创建 API Key",
    dependencies=[Depends(require_admin)],
)
async def create_api_key(body: CreateAPIKeyRequest) -> CreateAPIKeyResponse:
    """
    创建新的 API Key（仅在响应中返回一次，请立即保存）
    - API Key 原文不会存储，仅保存 SHA-256 哈希
    - 支持租户/项目级隔离与自定义限流策略
    """
    raw_key = generate_api_key(prefix=f"sgk-{body.tenant_id[:8]}")
    
    record = APIKeyRecord(
        tenant_id=body.tenant_id,
        project_id=body.project_id,
        scope=body.scope,
        description=body.description,
        active=True,
        rate_limit_policy=RateLimitPolicy(
            qps=body.rate_limit_qps,
            burst=body.rate_limit_qps * 2,
            daily_quota=body.rate_limit_daily,
        ),
        allowed_paths=body.allowed_paths,
    )
    
    key_hash = await APIKeyStore.store_record(raw_key, record)
    hash_prefix = key_hash[:8]
    
    logger.info(
        "API Key created",
        tenant_id=body.tenant_id,
        project_id=body.project_id,
        hash_prefix=hash_prefix,
    )
    
    return CreateAPIKeyResponse(
        api_key=raw_key,
        key_hash_prefix=hash_prefix,
        tenant_id=body.tenant_id,
        project_id=body.project_id,
        created_at=record.created_at,
    )


@admin_router.delete(
    "/keys",
    summary="撤销 API Key",
    dependencies=[Depends(require_admin)],
)
async def revoke_api_key(body: RevokeAPIKeyRequest) -> dict:
    """立即撤销 API Key（从存储删除，无法恢复）"""
    revoked = await APIKeyStore.revoke_key(body.api_key)
    if revoked:
        logger.info("API Key revoked", key_prefix=body.api_key[:12] + "***")
    return {"revoked": revoked}


@admin_router.get(
    "/backend/status",
    summary="后端链路状态详情",
    dependencies=[Depends(require_admin)],
)
async def backend_status() -> dict:
    return cq_service.get_status()
