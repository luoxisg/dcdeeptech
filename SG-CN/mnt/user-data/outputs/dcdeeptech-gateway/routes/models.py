"""
routes/models.py — GET /v1/models

Proxies the upstream model list, normalizes it to OpenAI schema, and returns
a fallback containing the default model if upstream is unreachable.
"""

import logging
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from adapters import adapt_model_list_to_openai
from auth import verify_api_key
from config import settings
from models import ModelListResponse, ModelObject

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/models",
    response_model=ModelListResponse,
    dependencies=[Depends(verify_api_key)],
    tags=["models"],
)
async def list_models(request: Request) -> ModelListResponse:
    """
    Return available models from the upstream backend, normalized to the
    OpenAI /v1/models response schema.
    """
    client: httpx.AsyncClient = request.app.state.http_client
    upstream_url = f"{settings.sophnet_api_url}/v1/models"
    headers = _upstream_headers()

    try:
        resp = await client.get(upstream_url, headers=headers)
        logger.info("models: upstream responded %d", resp.status_code)

        if resp.status_code == 200:
            return adapt_model_list_to_openai(resp.json())

        logger.warning("models: upstream returned %d, using fallback", resp.status_code)

    except httpx.TimeoutException:
        logger.warning("models: upstream timeout, using fallback")
    except Exception as exc:
        logger.error("models: upstream error — %s", exc)

    # Fallback — expose at least the configured default model
    return ModelListResponse(
        data=[ModelObject(id=settings.default_model, created=int(time.time()))]
    )


def _upstream_headers() -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.sophnet_auth_mode == "bearer":
        headers["Authorization"] = f"Bearer {settings.sophnet_api_key}"
    return headers
