"""
middleware/rate_limit.py — Simple in-process token-bucket rate limiter.

Keyed by the client's Bearer token so different clients get independent
buckets. Designed for single-instance use; for multi-replica deployments
replace the in-memory store with a Redis backend (see comment below).

Configuration via environment:
    RATE_LIMIT_REQUESTS  — requests allowed per window (default: 60)
    RATE_LIMIT_WINDOW    — window size in seconds (default: 60)
    RATE_LIMIT_ENABLED   — "true" / "false" (default: true)
"""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, default))
    except ValueError:
        return default


RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_REQUESTS: int = _env_int("RATE_LIMIT_REQUESTS", 60)
RATE_LIMIT_WINDOW: int = _env_int("RATE_LIMIT_WINDOW", 60)


class _Bucket:
    """Sliding-window counter for a single client key."""

    __slots__ = ("tokens", "last_refill", "lock")

    def __init__(self):
        self.tokens: int = RATE_LIMIT_REQUESTS
        self.last_refill: float = time.monotonic()
        self.lock = Lock()

    def consume(self) -> tuple[bool, int]:
        """
        Try to consume one token.
        Returns (allowed: bool, remaining: int).
        """
        with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            if elapsed >= RATE_LIMIT_WINDOW:
                self.tokens = RATE_LIMIT_REQUESTS
                self.last_refill = now

            if self.tokens > 0:
                self.tokens -= 1
                return True, self.tokens
            return False, 0


# ---------------------------------------------------------------------------
# Global bucket store
# NOTE: Replace with Redis for multi-replica setups:
#   import redis.asyncio as aioredis
#   r = aioredis.from_url(os.getenv("REDIS_URL"))
#   await r.incr(f"rl:{key}") + expire logic
# ---------------------------------------------------------------------------
_buckets: dict[str, _Bucket] = defaultdict(_Bucket)
_store_lock = Lock()


def _get_bucket(key: str) -> _Bucket:
    with _store_lock:
        return _buckets[key]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Per-client rate limiting middleware.

    Exempt paths: /health, /
    All other paths (including /v1/*) are rate-limited.
    """

    EXEMPT_PATHS = {"/health", "/", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if not RATE_LIMIT_ENABLED or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Key by Bearer token; fall back to client IP
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            client_key = auth[7:]
        else:
            client_key = request.client.host if request.client else "anonymous"

        bucket = _get_bucket(client_key)
        allowed, remaining = bucket.consume()

        if not allowed:
            logger.warning(
                "rate_limit: key=%s path=%s — limit exceeded",
                client_key[:8] + "***",  # partial key, not full secret
                request.url.path,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Max {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW}s.",
                headers={
                    "Retry-After": str(RATE_LIMIT_WINDOW),
                    "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
