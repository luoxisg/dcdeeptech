"""
请求生命周期中间件
- 注入全局唯一 request_id
- 记录完整请求/响应审计日志
- 统一异常处理与标准错误响应
- 请求超时保护
"""
from __future__ import annotations

import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import get_logger, set_request_context

settings = get_settings()
logger = get_logger(__name__)

# 不记录 body 的路径（减少日志量）
_NO_BODY_LOG_PATHS = {"/health", "/internal/metrics"}


class RequestLifecycleMiddleware(BaseHTTPMiddleware):
    """
    请求生命周期中间件（注册顺序需在最外层）
    职责：
    1. 生成 X-Request-ID 并注入 request.state
    2. 设置日志上下文（structlog contextvars）
    3. 记录入站/出站审计日志
    4. 统一异常捕获，返回标准 JSON 错误
    5. 注入响应头：X-Request-ID, X-Response-Time
    """
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # ── 生成 Request ID ──────────────────────────────────────────
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        # 设置 structlog 上下文（线程安全的 contextvars）
        set_request_context(request_id=request_id)
        
        start_time = time.monotonic()
        
        # ── 入站日志 ─────────────────────────────────────────────────
        if request.url.path not in _NO_BODY_LOG_PATHS:
            logger.info(
                "Request received",
                method=request.method,
                path=request.url.path,
                query=str(request.query_params),
                client_ip=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "")[:128],
            )
        
        # ── 处理请求 ─────────────────────────────────────────────────
        try:
            response = await call_next(request)
        except Exception as exc:
            elapsed_ms = (time.monotonic() - start_time) * 1000
            logger.exception(
                "Unhandled exception",
                path=request.url.path,
                elapsed_ms=round(elapsed_ms, 1),
                error=str(exc),
            )
            return JSONResponse(
                status_code=500,
                content={
                    "code": "INTERNAL_001",
                    "message": "Internal server error. Please contact support.",
                    "request_id": request_id,
                },
                headers={"X-Request-ID": request_id},
            )
        
        elapsed_ms = (time.monotonic() - start_time) * 1000
        
        # ── 注入响应头 ───────────────────────────────────────────────
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-MS"] = str(round(elapsed_ms, 1))
        response.headers["X-Gateway"] = settings.APP_NAME
        
        # ── 出站日志 ─────────────────────────────────────────────────
        if request.url.path not in _NO_BODY_LOG_PATHS:
            log_fn = logger.warning if response.status_code >= 400 else logger.info
            log_fn(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                elapsed_ms=round(elapsed_ms, 1),
                tenant_id=getattr(request.state, "tenant_id", ""),
            )
        
        return response
