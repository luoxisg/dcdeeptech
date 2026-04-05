"""
api.dcdeeptech.com — Singapore AI Gateway
FastAPI entrypoint: mounts routes, manages httpx client lifecycle.
"""

import contextlib
import logging

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routes import chat, health, models
from utils.logging import configure_logging
from utils.request_id import RequestIDMiddleware

configure_logging()
logger = logging.getLogger(__name__)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage shared async httpx client across the app lifetime."""
    timeout = httpx.Timeout(settings.request_timeout, connect=10.0)
    app.state.http_client = httpx.AsyncClient(timeout=timeout)
    logger.info(
        "Gateway starting — upstream: %s  default_model: %s",
        settings.sophnet_api_url,
        settings.default_model,
    )
    yield
    await app.state.http_client.aclose()
    logger.info("Gateway shutting down — httpx client closed.")


app = FastAPI(
    title="DCDeepTech AI Gateway",
    description="OpenAI-compatible Singapore gateway for cross-border inference.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(models.router, prefix="/v1")
app.include_router(chat.router, prefix="/v1")


@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse(
        {
            "service": "DCDeepTech AI Gateway",
            "domain": "api.dcdeeptech.com",
            "region": "Singapore",
            "openai_compatible": True,
            "endpoints": ["/health", "/v1/models", "/v1/chat/completions"],
        }
    )


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.gateway_host,
        port=settings.gateway_port,
        log_level="info",
        access_log=False,  # handled by middleware
    )
