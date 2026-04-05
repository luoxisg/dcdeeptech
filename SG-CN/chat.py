"""
routes/chat.py — POST /v1/chat/completions

Handles both streaming and non-streaming chat completion requests.
Proxies to the upstream vLLM / Qwen-VL inference backend, normalizes
responses to OpenAI-compatible format.
"""

from __future__ import annotations

import logging
import time
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from adapters import adapt_request_to_upstream, adapt_response_to_openai
from auth import verify_api_key
from config import settings
from models import ChatCompletionRequest

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post(
    "/chat/completions",
    dependencies=[Depends(verify_api_key)],
    tags=["chat"],
)
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
):
    """
    OpenAI-compatible chat completions endpoint.

    Supports:
    - Text-only messages
    - Multimodal messages (image_url content parts for Qwen-VL)
    - stream=false (default) — returns full JSON response
    - stream=true — proxies SSE stream from upstream
    """
    request_id: str = getattr(request.state, "request_id", "unknown")
    t0 = time.monotonic()

    upstream_payload = adapt_request_to_upstream(body)
    upstream_url = f"{settings.sophnet_api_url}/v1/chat/completions"
    headers = _upstream_headers()

    logger.info(
        "chat: request_id=%s model=%s stream=%s",
        request_id,
        body.model,
        body.stream,
    )

    client: httpx.AsyncClient = request.app.state.http_client

    if body.stream:
        return await _handle_streaming(
            client, upstream_url, headers, upstream_payload, body.model, request_id, t0
        )
    else:
        return await _handle_non_streaming(
            client, upstream_url, headers, upstream_payload, body.model, request_id, t0
        )


# ---------------------------------------------------------------------------
# Non-streaming
# ---------------------------------------------------------------------------


async def _handle_non_streaming(
    client: httpx.AsyncClient,
    url: str,
    headers: dict,
    payload: dict,
    model: str,
    request_id: str,
    t0: float,
) -> JSONResponse:
    try:
        resp = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException:
        logger.error("chat: request_id=%s upstream timeout", request_id)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Upstream inference backend timed out.",
        )
    except httpx.RequestError as exc:
        logger.error("chat: request_id=%s network error — %s", request_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach upstream inference backend.",
        )

    latency = (time.monotonic() - t0) * 1000
    logger.info(
        "chat: request_id=%s upstream_status=%d latency_ms=%.1f",
        request_id,
        resp.status_code,
        latency,
    )

    if resp.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream authentication failed. Check SOPHNET_API_KEY.",
        )

    if resp.status_code >= 400:
        # Propagate upstream error body to caller
        try:
            err_body = resp.json()
        except Exception:
            err_body = {"detail": resp.text}
        raise HTTPException(status_code=resp.status_code, detail=err_body)

    try:
        upstream_data = resp.json()
    except Exception as exc:
        logger.error("chat: request_id=%s failed to parse upstream JSON — %s", request_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream returned non-JSON response.",
        )

    normalized = adapt_response_to_openai(upstream_data, fallback_model=model)
    return JSONResponse(
        content=normalized.model_dump(exclude_none=True),
        headers={"x-request-id": request_id},
    )


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------


async def _handle_streaming(
    client: httpx.AsyncClient,
    url: str,
    headers: dict,
    payload: dict,
    model: str,
    request_id: str,
    t0: float,
) -> StreamingResponse:
    """
    Proxy the SSE stream from upstream to the client.

    We open an httpx streaming request and yield each chunk as-is.
    vLLM emits standard OpenAI SSE format (data: {...}\n\n), so pass-through
    is correct. If the upstream format ever deviates, insert normalization
    logic inside _stream_generator.
    """

    async def _stream_generator() -> AsyncIterator[bytes]:
        try:
            async with client.stream(
                "POST", url, json=payload, headers=headers
            ) as upstream:
                if upstream.status_code >= 400:
                    # Yield an error SSE event then close
                    logger.error(
                        "chat: request_id=%s streaming upstream error %d",
                        request_id,
                        upstream.status_code,
                    )
                    error_event = (
                        f'data: {{"error": "Upstream returned {upstream.status_code}"}}\n\n'
                    )
                    yield error_event.encode()
                    return

                async for chunk in upstream.aiter_bytes():
                    yield chunk

        except httpx.TimeoutException:
            logger.error("chat: request_id=%s streaming timeout", request_id)
            yield b'data: {"error": "upstream timeout"}\n\n'
        except httpx.RequestError as exc:
            logger.error("chat: request_id=%s streaming network error — %s", request_id, exc)
            yield b'data: {"error": "upstream network error"}\n\n'
        except Exception as exc:
            logger.error("chat: request_id=%s unexpected streaming error — %s", request_id, exc)
            yield b'data: {"error": "internal gateway error"}\n\n'
        finally:
            latency = (time.monotonic() - t0) * 1000
            logger.info(
                "chat: request_id=%s stream_done latency_ms=%.1f", request_id, latency
            )

    return StreamingResponse(
        _stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
            "x-request-id": request_id,
        },
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _upstream_headers() -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.sophnet_auth_mode == "bearer":
        headers["Authorization"] = f"Bearer {settings.sophnet_api_key}"
    return headers
