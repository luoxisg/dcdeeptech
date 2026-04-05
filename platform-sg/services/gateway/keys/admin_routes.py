"""
Admin API — DCDeepTech API Key management endpoints.

All routes require the 'admin:keys' scope.
In production, these should also be restricted to internal network CIDRs
(see ADMIN_ALLOWED_CIDRS in .env).

Mounted at /admin by app/main.py.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from gateway.auth.tenant_auth import require_auth
from .schemas import CreateKeyRequest, CreateKeyResponse, KeyListResponse
from .service import ApiKeyService

router = APIRouter()

# Singleton — reuses the same DB connection pool
_svc = ApiKeyService()


def _require_admin_scope(tenant: dict = Depends(require_auth)) -> dict:
    """Sub-dependency: require auth AND admin:keys scope."""
    if "admin:keys" not in tenant.get("scopes", []):
        raise HTTPException(status_code=403, detail="Scope 'admin:keys' required")
    return tenant


# ── Create ─────────────────────────────────────────────────────────────────────

@router.post("/api-keys", response_model=CreateKeyResponse, status_code=201)
async def create_api_key(
    body: CreateKeyRequest,
    _: dict = Depends(_require_admin_scope),
):
    """
    Create a new DCDeepTech API key.

    **The full key is returned ONCE in this response. It cannot be retrieved again.**
    Store it immediately in a secrets manager or password vault.
    """
    return _svc.create_key(body)


# ── List ───────────────────────────────────────────────────────────────────────

@router.get("/api-keys", response_model=KeyListResponse)
async def list_api_keys(
    tenant_id: Optional[str] = None,
    _: dict = Depends(_require_admin_scope),
):
    """
    List all API keys, optionally filtered by tenant_id.
    Key secrets are never returned — only prefix and metadata.
    """
    return _svc.list_keys(tenant_id=tenant_id)


# ── Lifecycle ──────────────────────────────────────────────────────────────────

@router.post("/api-keys/{key_id}/disable", status_code=200)
async def disable_key(
    key_id: str,
    _: dict = Depends(_require_admin_scope),
):
    """Temporarily disable a key. Can be re-enabled by updating status (future)."""
    if not _svc.disable(key_id):
        raise HTTPException(status_code=404, detail="Key not found")
    return {"key_id": key_id, "status": "disabled"}


@router.post("/api-keys/{key_id}/revoke", status_code=200)
async def revoke_key(
    key_id: str,
    _: dict = Depends(_require_admin_scope),
):
    """Permanently revoke a key. This action is irreversible."""
    if not _svc.revoke(key_id):
        raise HTTPException(status_code=404, detail="Key not found")
    return {"key_id": key_id, "status": "revoked"}


@router.post("/api-keys/{key_id}/rotate", response_model=CreateKeyResponse)
async def rotate_key(
    key_id: str,
    tenant: dict = Depends(_require_admin_scope),
):
    """
    Revoke the specified key and issue a replacement with identical config.
    The new key is returned ONCE. The old key is immediately invalidated.
    """
    result = _svc.rotate(key_id, tenant["tenant_id"])
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Key not found or does not belong to your tenant",
        )
    return result
