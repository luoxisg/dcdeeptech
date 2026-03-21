"""
utils/request_id.py — Starlette middleware that stamps every request with a
unique X-Request-ID header (inbound if provided, generated if absent) and
echoes it in the response.
"""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a request ID to each request/response cycle."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or f"gw-{uuid.uuid4().hex[:12]}"
        request.state.request_id = request_id

        response: Response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response
