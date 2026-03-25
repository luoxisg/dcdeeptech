"""
新加坡算力 API 中台 - 应用入口
FastAPI 应用工厂，电信级配置
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import ORJSONResponse

from app.api.admin import admin_router, health_router
from app.api.proxy import router as proxy_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.middleware.lifecycle import RequestLifecycleMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.cq_forwarder import cq_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    setup_logging()
    logger = get_logger(__name__)
    
    logger.info(
        "Starting SG API Gateway",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )
    
    # 启动重庆后端连接与健康检查
    await cq_service.startup()
    
    logger.info("SG API Gateway is ready ✓")
    yield
    
    # 关闭清理
    logger.info("Shutting down SG API Gateway...")
    await cq_service.shutdown()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="新加坡算力 API 中台",
        description="""
## Singapore Compute API Gateway (MVP)

统一 API 接入层，通过中新数据通道访问重庆后端模型与算力资源。

### 核心特性
- 🔐 **API Key 鉴权** — SHA-256哈希存储，租户/项目级隔离
- 🛡️ **PDPA 合规** — 最小必要字段过滤，跨境传输审计
- 🔄 **中新链路转发** — 主备自动切换，熔断器保护
- 📊 **完整审计日志** — 结构化 JSON，PDPA留痕90天
- ⚡ **限流保护** — QPS/并发/日配额三层控制

### 数据流
`外部客户 → SG API Gateway (新加坡) → [PDPA Filter] → 重庆后端`
        """,
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )
    
    # ── 中间件（注册顺序：外 → 内，执行顺序：内 → 外）────────────
    
    # 1. 可信 Host 检查（最外层）
    if settings.ALLOWED_HOSTS != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)
    
    # 2. CORS
    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID", "X-Response-Time-MS"],
        )
    
    # 3. 请求生命周期（注入 request_id，审计日志）
    app.add_middleware(RequestLifecycleMiddleware)
    
    # 4. 限流（需在鉴权之后，因为鉴权中间件注入了 tenant_id）
    app.add_middleware(RateLimitMiddleware)
    
    # ── 路由注册 ────────────────────────────────────────────────────
    app.include_router(health_router)
    app.include_router(proxy_router)
    app.include_router(admin_router)
    
    # ── Prometheus 指标 ─────────────────────────────────────────────
    if settings.METRICS_ENABLED:
        try:
            from prometheus_client import make_asgi_app
            metrics_app = make_asgi_app()
            app.mount(settings.METRICS_PATH, metrics_app)
        except ImportError:
            pass
    
    return app


app = create_app()
