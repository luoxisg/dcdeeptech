"""
routes/health.py — GET /health

No auth required. Optionally checks upstream connectivity.
"""

import logging
import time

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", tags=["ops"])
async def health_check(request: Request) -> JSONResponse:
    """
    Returns gateway health and an optional upstream ping result.
    Safe to call without authentication (used by load-balancers, monitors).
    """
    ts = time.time()
    result: dict = {
        "status": "ok",
        "service": "DCDeepTech AI Gateway",
        "region": "Singapore",
        "timestamp": int(ts),
    }

    # Best-effort upstream ping — does NOT fail the health endpoint
    upstream_url = f"{settings.sophnet_api_url}/health"
    try:
        client: httpx.AsyncClient = request.app.state.http_client
        upstream_resp = await client.get(upstream_url, timeout=5.0)
        result["upstream"] = {
            "url": settings.sophnet_api_url,
            "status": upstream_resp.status_code,
            "reachable": upstream_resp.status_code < 500,
        }
    except Exception as exc:
        logger.warning("health: upstream ping failed — %s", exc)
        result["upstream"] = {
            "url": settings.sophnet_api_url,
            "reachable": False,
            "error": str(exc),
        }

    return JSONResponse(result)
