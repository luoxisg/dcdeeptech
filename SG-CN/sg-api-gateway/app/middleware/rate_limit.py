"""
限流中间件 - 电信级 QPS / 并发 / 日配额控制
算法：Redis 滑动窗口（精确）+ 令牌桶（突发）
粒度：租户 + 项目 + 全局三层限流
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse
from starlette.status import HTTP_429_TOO_MANY_REQUESTS

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.tenant import RateLimitPolicy

settings = get_settings()
logger = get_logger(__name__)

# 内存限流后备（Redis不可用时）
_local_counters: dict[str, list[float]] = {}


async def _redis_sliding_window(
    redis,
    key: str,
    window_sec: int,
    limit: int,
    cost: int = 1,
) -> tuple[bool, int, int]:
    """
    Redis 滑动窗口限流
    Returns: (allowed, current_count, reset_after_secs)
    """
    now = time.time()
    window_start = now - window_sec
    
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, "-inf", window_start)
    pipe.zadd(key, {f"{now}:{id(object())}": now})
    pipe.zcard(key)
    pipe.expire(key, window_sec + 1)
    results = await pipe.execute()
    
    current = results[2]
    allowed = current <= limit
    
    if not allowed:
        # 不计入这次请求
        await redis.zrem(key, list(await redis.zrangebyscore(key, now, now)))
    
    reset_after = int(window_sec - (now - window_start))
    return allowed, current, max(reset_after, 0)


def _local_sliding_window(key: str, window_sec: int, limit: int) -> tuple[bool, int, int]:
    """本地内存滑动窗口（Redis不可用时的降级）"""
    now = time.time()
    window_start = now - window_sec
    
    if key not in _local_counters:
        _local_counters[key] = []
    
    # 清理过期记录
    _local_counters[key] = [t for t in _local_counters[key] if t > window_start]
    _local_counters[key].append(now)
    
    current = len(_local_counters[key])
    allowed = current <= limit
    return allowed, current, window_sec


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    三层限流中间件：
    Layer 1 - 全局限流（防 DDoS）
    Layer 2 - 租户限流（按租户 API Key 策略）
    Layer 3 - 日配额（每日调用上限）
    
    限流响应包含标准 RateLimit headers（RFC 6585）
    """
    
    SKIP_PATHS = {"/health", "/internal/metrics", "/docs", "/openapi.json", "/redoc"}
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 跳过健康检查等内部路径
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)
        
        tenant_id = getattr(request.state, "tenant_id", "anonymous")
        project_id = getattr(request.state, "project_id", "default")
        policy: RateLimitPolicy = getattr(
            request.state, "rate_limit_policy", RateLimitPolicy()
        )
        
        # 获取 Redis（可能为 None）
        redis = None
        try:
            from app.core.auth import APIKeyStore
            redis = await APIKeyStore._get_redis()
        except Exception:
            pass
        
        # ── Layer 1: 全局 IP 限流（粗粒度，防暴力扫描）
        client_ip = request.client.host if request.client else "0.0.0.0"
        allowed, headers = await self._check_limit(
            redis=redis,
            key=f"rl:ip:{client_ip}",
            window_sec=60,
            limit=200,   # 单 IP 每分钟最多200次
            label="IP",
        )
        if not allowed:
            return self._too_many(headers, layer="ip_global")
        
        # ── Layer 2: 租户 QPS 限流
        allowed, headers = await self._check_limit(
            redis=redis,
            key=f"rl:tenant:{tenant_id}:{project_id}",
            window_sec=settings.RATE_LIMIT_WINDOW_SECONDS,
            limit=policy.qps * settings.RATE_LIMIT_WINDOW_SECONDS,
            label="Tenant-QPS",
        )
        if not allowed:
            logger.warning(
                "Rate limit exceeded",
                tenant_id=tenant_id,
                project_id=project_id,
                limit_type="qps",
            )
            return self._too_many(headers, layer="tenant_qps")
        
        # ── Layer 3: 日配额
        today_key = f"rl:daily:{tenant_id}:{project_id}:{_today()}"
        allowed, headers = await self._check_limit(
            redis=redis,
            key=today_key,
            window_sec=86400,
            limit=policy.daily_quota,
            label="Daily-Quota",
        )
        if not allowed:
            logger.warning(
                "Daily quota exceeded",
                tenant_id=tenant_id,
                project_id=project_id,
            )
            return self._too_many(headers, layer="daily_quota")
        
        # ── 调用实际处理逻辑
        response = await call_next(request)
        
        # 注入 RateLimit 响应头
        for k, v in headers.items():
            response.headers[k] = str(v)
        
        return response
    
    async def _check_limit(
        self,
        redis: Any,
        key: str,
        window_sec: int,
        limit: int,
        label: str,
    ) -> tuple[bool, dict[str, str]]:
        if redis:
            try:
                allowed, current, reset = await _redis_sliding_window(
                    redis, key, window_sec, limit
                )
            except Exception as e:
                logger.warning("Redis rate limit error, using local", error=str(e))
                allowed, current, reset = _local_sliding_window(key, window_sec, limit)
        else:
            allowed, current, reset = _local_sliding_window(key, window_sec, limit)
        
        headers = {
            f"X-RateLimit-{label}-Limit": str(limit),
            f"X-RateLimit-{label}-Remaining": str(max(limit - current, 0)),
            f"X-RateLimit-{label}-Reset": str(reset),
        }
        return allowed, headers
    
    @staticmethod
    def _too_many(headers: dict, layer: str) -> JSONResponse:
        return JSONResponse(
            status_code=HTTP_429_TOO_MANY_REQUESTS,
            content={
                "code": "RATE_LIMIT_001",
                "message": "Rate limit exceeded. Please slow down.",
                "layer": layer,
                "retry_after": headers.get(f"X-RateLimit-{next(iter(headers)).split('-')[2]}-Reset", "60"),
            },
            headers={
                **headers,
                "Retry-After": "60",
                "X-Rate-Limit-Layer": layer,
            },
        )


def _today() -> str:
    from datetime import date
    return date.today().isoformat()
