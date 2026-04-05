"""
API Key service — business logic layer.

Sits between admin_routes (HTTP) and repository (SQLite).
All key operations go through this service, never directly to the repository.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from .generator import generate_api_key, extract_prefix
from .hashing import hash_key, verify_key
from .repository import ApiKeyRepository, ApiKeyRow
from .schemas import (
    CreateKeyRequest,
    CreateKeyResponse,
    KeyRecord,
    KeyListResponse,
    KeyScope,
    KeyStatus,
)

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _repo() -> ApiKeyRepository:
    """Singleton repository — avoids re-initialising DB on every request."""
    return ApiKeyRepository()


class ApiKeyService:
    def __init__(self, repo: Optional[ApiKeyRepository] = None):
        self._repo = repo or _repo()

    # ── Create ────────────────────────────────────────────────────────────────

    def create_key(self, req: CreateKeyRequest) -> CreateKeyResponse:
        """
        Generate, hash, and persist a new API key.
        The full plaintext key is returned ONCE in the response.
        Only the prefix and hash are stored.
        """
        full_key, key_id = generate_api_key()
        prefix = extract_prefix(full_key)
        salt, key_hash = hash_key(full_key)
        now = datetime.now(timezone.utc)

        row = ApiKeyRow(
            key_id=key_id,
            key_prefix=prefix,
            key_hash=key_hash,
            key_salt=salt,
            tenant_id=req.tenant_id,
            scopes=json.dumps([s.value for s in req.scopes]),
            status="active",
            description=req.description,
            created_at=now.isoformat(),
            expires_at=req.expires_at.isoformat() if req.expires_at else None,
            last_used_at=None,
        )
        self._repo.insert(row)

        # Log key creation — only prefix/key_id, never full key
        logger.info(
            "key.created prefix=%s key_id=%s tenant=%s scopes=%s",
            prefix, key_id, req.tenant_id,
            [s.value for s in req.scopes],
        )

        return CreateKeyResponse(
            key_id=key_id,
            key=full_key,          # <-- ONLY time full key is returned
            key_prefix=prefix,
            tenant_id=req.tenant_id,
            scopes=[s.value for s in req.scopes],
            created_at=now,
            expires_at=req.expires_at,
        )

    # ── Authenticate ─────────────────────────────────────────────────────────

    def authenticate(self, raw_key: str) -> Optional[dict]:
        """
        Validate a raw DCDeepTech API key.

        Returns a tenant context dict on success:
            {"key_id", "tenant_id", "scopes": [...], "key_prefix"}
        Returns None if invalid, disabled, revoked, or expired.

        NOTE: logs only prefix/key_id — never the raw key.
        """
        if not raw_key or not raw_key.startswith("sk-dcdt-"):
            return None

        prefix_start = raw_key[:14]   # "sk-dcdt-AbCdEf" — enough to narrow candidates
        candidates = self._repo.find_active_by_prefix_start(prefix_start)

        for row in candidates:
            # Expiry check
            if row.expires_at:
                if datetime.fromisoformat(row.expires_at) < datetime.now(timezone.utc):
                    self._repo.update_status(row.key_id, "expired")
                    logger.warning("key.expired key_id=%s", row.key_id)
                    continue

            # Constant-time hash verification
            if verify_key(raw_key, row.key_salt, row.key_hash):
                self._repo.update_last_used(row.key_id)
                logger.info(
                    "key.authenticated key_id=%s tenant=%s",
                    row.key_id, row.tenant_id,
                )
                return {
                    "key_id": row.key_id,
                    "tenant_id": row.tenant_id,
                    "scopes": json.loads(row.scopes),
                    "key_prefix": row.key_prefix,
                }

        logger.warning("key.auth_failed prefix_start=%s", prefix_start)
        return None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def disable(self, key_id: str) -> bool:
        ok = self._repo.update_status(key_id, "disabled")
        if ok:
            logger.info("key.disabled key_id=%s", key_id)
        return ok

    def revoke(self, key_id: str) -> bool:
        ok = self._repo.update_status(key_id, "revoked")
        if ok:
            logger.info("key.revoked key_id=%s", key_id)
        return ok

    def rotate(self, key_id: str, caller_tenant_id: str) -> Optional[CreateKeyResponse]:
        """
        Revoke the old key and issue a new one with the same tenant + scopes.
        Returns None if key_id not found or belongs to a different tenant.
        """
        old = self._repo.find_by_id(key_id)
        if not old or old.tenant_id != caller_tenant_id:
            return None

        self._repo.update_status(key_id, "revoked")
        logger.info("key.rotated old_key_id=%s tenant=%s", key_id, caller_tenant_id)

        req = CreateKeyRequest(
            tenant_id=caller_tenant_id,
            description=f"Rotated from {key_id}: {old.description}",
            scopes=[KeyScope(s) for s in json.loads(old.scopes)],
        )
        return self.create_key(req)

    # ── List ──────────────────────────────────────────────────────────────────

    def list_keys(self, tenant_id: Optional[str] = None) -> KeyListResponse:
        rows = self._repo.list_by_tenant(tenant_id) if tenant_id else self._repo.list_all()

        records = [
            KeyRecord(
                key_id=r.key_id,
                key_prefix=r.key_prefix,
                tenant_id=r.tenant_id,
                description=r.description,
                scopes=json.loads(r.scopes),
                status=KeyStatus(r.status),
                created_at=datetime.fromisoformat(r.created_at),
                expires_at=datetime.fromisoformat(r.expires_at) if r.expires_at else None,
                last_used_at=datetime.fromisoformat(r.last_used_at) if r.last_used_at else None,
            )
            for r in rows
        ]
        return KeyListResponse(keys=records, total=len(records))
