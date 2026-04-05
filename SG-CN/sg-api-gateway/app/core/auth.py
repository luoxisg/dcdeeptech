"""
API Key 鉴权模块 - 电信级多租户隔离
- SHA-256 哈希存储，原始 Key 不落盘
- Redis 缓存：热路径鉴权 < 1ms
- 租户 / 项目 两级隔离
- 完整审计日志
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import get_settings
from app.core.logging import audit_logger, get_logger
from app.models.tenant import APIKeyRecord, TenantConfig, RateLimitPolicy

settings = get_settings()
logger = get_logger(__name__)

_api_key_header = APIKeyHeader(name=settings.API_KEY_HEADER, auto_error=False)


class KeyScope(str, Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


# ── Redis Key 存储层（生产用 Redis，开发用内存）──────────────────────
class APIKeyStore:
    """
    API Key 存储与验证
    
    存储结构（Redis Hash）：
      apikey:{hash} -> {tenant_id, project_id, scope, rate_limit, active, created_at, ...}
    
    缓存 TTL: 300s（Key变更时主动失效）
    """
    
    _in_memory: dict[str, APIKeyRecord] = {}   # 开发/测试用
    _redis_client = None
    
    @classmethod
    async def _get_redis(cls):
        if cls._redis_client is None:
            try:
                import redis.asyncio as aioredis
                cls._redis_client = aioredis.from_url(
                    settings.REDIS_URL,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
                    decode_responses=True,
                )
                await cls._redis_client.ping()
            except Exception as e:
                logger.warning("Redis unavailable, falling back to in-memory store", error=str(e))
                cls._redis_client = None
        return cls._redis_client
    
    @classmethod
    def _hash_key(cls, raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    
    @classmethod
    def _safe_compare(cls, raw_key: str, stored_hash: str) -> bool:
        """防时序攻击的恒定时间比较"""
        computed = cls._hash_key(raw_key)
        return hmac.compare_digest(computed, stored_hash)
    
    @classmethod
    async def get_record(cls, raw_key: str) -> APIKeyRecord | None:
        key_hash = cls._hash_key(raw_key)
        redis_key = f"apikey:{key_hash}"
        
        redis = await cls._get_redis()
        if redis:
            try:
                data = await redis.hgetall(redis_key)
                if data:
                    return APIKeyRecord(**data)
            except Exception as e:
                logger.warning("Redis read error, falling back", error=str(e))
        
        # 内存回退
        return cls._in_memory.get(key_hash)
    
    @classmethod
    async def store_record(cls, raw_key: str, record: APIKeyRecord) -> str:
        key_hash = cls._hash_key(raw_key)
        redis_key = f"apikey:{key_hash}"
        
        redis = await cls._get_redis()
        if redis:
            try:
                data = record.model_dump(mode="json")
                await redis.hset(redis_key, mapping={k: str(v) for k, v in data.items()})
                await redis.expire(redis_key, 86400 * 365)  # 1年，实际由revoke控制
                return key_hash
            except Exception as e:
                logger.warning("Redis write error, using in-memory", error=str(e))
        
        cls._in_memory[key_hash] = record
        return key_hash
    
    @classmethod
    async def revoke_key(cls, raw_key: str) -> bool:
        key_hash = cls._hash_key(raw_key)
        redis_key = f"apikey:{key_hash}"
        
        redis = await cls._get_redis()
        if redis:
            try:
                result = await redis.delete(redis_key)
                return result > 0
            except Exception:
                pass
        
        if key_hash in cls._in_memory:
            del cls._in_memory[key_hash]
            return True
        return False
    
    @classmethod
    async def set_inactive(cls, raw_key: str) -> bool:
        record = await cls.get_record(raw_key)
        if not record:
            return False
        record.active = False
        await cls.store_record(raw_key, record)
        return True


# ── 鉴权依赖注入 ───────────────────────────────────────────────────
async def authenticate_request(
    request: Request,
    api_key_raw: Annotated[str | None, Security(_api_key_header)] = None,
) -> APIKeyRecord:
    """
    FastAPI 依赖：验证 API Key 并返回租户上下文
    注入到所有需要鉴权的路由
    """
    request_id = request.state.request_id
    client_ip = request.client.host if request.client else "unknown"
    
    if not api_key_raw:
        audit_logger.log_api_key_event(request_id, "AUTH_FAILURE_MISSING", ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_001",
                "message": f"API Key required. Please provide '{settings.API_KEY_HEADER}' header.",
            },
            headers={"WWW-Authenticate": f"ApiKey realm=\"{settings.APP_NAME}\""},
        )
    
    if len(api_key_raw) < settings.API_KEY_MIN_LENGTH:
        audit_logger.log_api_key_event(request_id, "AUTH_FAILURE_INVALID", ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_002", "message": "Invalid API Key format."},
        )
    
    record = await APIKeyStore.get_record(api_key_raw)
    
    if record is None:
        audit_logger.log_api_key_event(request_id, "AUTH_FAILURE_NOTFOUND", ip_address=client_ip)
        logger.warning("API key not found", request_id=request_id, ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_003", "message": "Invalid or expired API Key."},
        )
    
    if not record.active:
        audit_logger.log_api_key_event(request_id, "AUTH_FAILURE_INACTIVE", 
                                        tenant_id=record.tenant_id, ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_004", "message": "API Key has been revoked."},
        )
    
    # 租户上下文注入到 request.state
    request.state.tenant_id = record.tenant_id
    request.state.project_id = record.project_id
    request.state.key_scope = record.scope
    request.state.rate_limit_policy = record.rate_limit_policy
    
    audit_logger.log_api_key_event(
        request_id, "AUTH_SUCCESS",
        tenant_id=record.tenant_id, ip_address=client_ip,
    )
    logger.info(
        "Request authenticated",
        tenant_id=record.tenant_id,
        project_id=record.project_id,
    )
    return record


async def require_admin(
    request: Request,
    api_key_raw: Annotated[str | None, Security(_api_key_header)] = None,
) -> None:
    """管理接口专用：验证管理员 Key"""
    if not api_key_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin key required")
    
    if not hmac.compare_digest(api_key_raw, settings.ADMIN_API_KEY):
        audit_logger.log_api_key_event(
            getattr(request.state, "request_id", ""),
            "ADMIN_AUTH_FAILURE",
            ip_address=request.client.host if request.client else "",
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def generate_api_key(prefix: str = "sgk") -> str:
    """生成符合长度要求的随机 API Key"""
    token = secrets.token_urlsafe(32)
    return f"{prefix}_{token}"
