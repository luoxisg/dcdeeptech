"""
FastAPI authentication dependency for DCDeepTech API keys.

Usage:
    from gateway.auth.tenant_auth import require_auth

    @router.post("/v1/chat/completions")
    async def handler(tenant: dict = Depends(require_auth)):
        tenant["tenant_id"]   # resolved tenant
        tenant["scopes"]      # list of granted scopes
        tenant["key_id"]      # for audit logging
        tenant["key_prefix"]  # for display / logging (non-secret)
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _service():
    """Lazy singleton — avoids import-time DB initialisation."""
    from keys.service import ApiKeyService
    return ApiKeyService()


async def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency: validate DCDeepTech API key, return tenant context.

    Attaches context to request.state.tenant for downstream middleware.
    Raises HTTP 401 on missing/invalid key.
    Raises HTTP 403 if key exists but is disabled/revoked/expired.
    """
    token: Optional[str] = None

    if credentials:
        token = credentials.credentials
    else:
        # Fallback: check raw Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization: Bearer <dcdt-api-key>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tenant_ctx = _service().authenticate(token)

    if tenant_ctx is None:
        # Log only the non-secret prefix for debugging
        prefix_hint = token[:12] if len(token) >= 12 else "?"
        logger.warning("auth.rejected prefix=%s", prefix_hint)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked API key",
        )

    request.state.tenant = tenant_ctx
    return tenant_ctx


def require_scope(scope: str):
    """
    Dependency factory: require auth AND a specific scope.

    Usage:
        @router.get("/foo")
        async def foo(tenant: dict = Depends(require_scope("embeddings"))):
            ...
    """
    async def _check(tenant: dict = Depends(require_auth)) -> dict:
        if scope not in tenant.get("scopes", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope '{scope}' is required for this endpoint",
            )
        return tenant
    return _check
