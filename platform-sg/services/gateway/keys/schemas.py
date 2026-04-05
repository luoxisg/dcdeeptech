"""
Pydantic schemas for the DCDeepTech API Key management API.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class KeyStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    REVOKED = "revoked"
    EXPIRED = "expired"


class KeyScope(str, Enum):
    CHAT_COMPLETIONS = "chat:completions"
    EMBEDDINGS = "embeddings"
    ADMIN_KEYS = "admin:keys"
    ADMIN_TENANTS = "admin:tenants"
    INTERNAL_ROUTING = "internal:routing"


# ── Request bodies ────────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant / organisation identifier")
    description: str = Field("", description="Human-readable label for this key")
    scopes: list[KeyScope] = Field(
        default=[KeyScope.CHAT_COMPLETIONS],
        description="Permissions granted to this key",
    )
    expires_at: Optional[datetime] = Field(
        None,
        description="ISO-8601 expiry timestamp. Omit for no expiry.",
    )


# ── Response bodies ───────────────────────────────────────────────────────────

class CreateKeyResponse(BaseModel):
    key_id: str
    key: str = Field(..., description="Full key — shown ONCE. Store securely.")
    key_prefix: str = Field(..., description="Non-secret prefix for identification")
    tenant_id: str
    scopes: list[str]
    created_at: datetime
    expires_at: Optional[datetime]
    message: str = "This key will not be shown again. Store it securely."


class KeyRecord(BaseModel):
    """Safe read-only view of a key — full secret is never returned after creation."""
    key_id: str
    key_prefix: str
    tenant_id: str
    description: str
    scopes: list[str]
    status: KeyStatus
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]


class KeyListResponse(BaseModel):
    keys: list[KeyRecord]
    total: int
