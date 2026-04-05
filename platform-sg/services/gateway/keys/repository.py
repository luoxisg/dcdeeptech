"""
SQLite-backed API Key repository.

Design notes:
- Only stores: key_id, key_prefix (display), key_hash, key_salt, metadata
- Full plaintext key is NEVER stored
- Schema is intentionally thin — ready for migration to PostgreSQL / DynamoDB
- Thread-safe: each operation opens/closes its own connection (SQLite WAL mode)
"""

from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

_DEFAULT_DB = Path(os.getenv("KEY_DB_PATH", "data/keys.db"))


@dataclass
class ApiKeyRow:
    key_id: str
    key_prefix: str     # e.g. "sk-dcdt-AbCdEf..." — non-secret identifier
    key_hash: str       # PBKDF2 hex digest
    key_salt: str       # per-key random salt hex
    tenant_id: str
    scopes: str         # JSON-encoded list[str]
    status: str         # active | disabled | revoked | expired
    description: str
    created_at: str     # ISO-8601
    expires_at: Optional[str]
    last_used_at: Optional[str]


class ApiKeyRepository:
    def __init__(self, db_path: Path = _DEFAULT_DB):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    # ── Schema ────────────────────────────────────────────────────────────────

    def _init_schema(self) -> None:
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS api_keys (
                    key_id       TEXT PRIMARY KEY,
                    key_prefix   TEXT NOT NULL,
                    key_hash     TEXT NOT NULL,
                    key_salt     TEXT NOT NULL,
                    tenant_id    TEXT NOT NULL,
                    scopes       TEXT NOT NULL DEFAULT '[]',
                    status       TEXT NOT NULL DEFAULT 'active',
                    description  TEXT NOT NULL DEFAULT '',
                    created_at   TEXT NOT NULL,
                    expires_at   TEXT,
                    last_used_at TEXT
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_prefix   ON api_keys(key_prefix)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_tenant   ON api_keys(tenant_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_status   ON api_keys(status)"
            )

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _row(self, r: sqlite3.Row) -> ApiKeyRow:
        return ApiKeyRow(**dict(r))

    # ── Write operations ──────────────────────────────────────────────────────

    def insert(self, row: ApiKeyRow) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO api_keys
                  (key_id, key_prefix, key_hash, key_salt, tenant_id,
                   scopes, status, description, created_at, expires_at, last_used_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    row.key_id, row.key_prefix, row.key_hash, row.key_salt,
                    row.tenant_id, row.scopes, row.status, row.description,
                    row.created_at, row.expires_at, row.last_used_at,
                ),
            )

    def update_status(self, key_id: str, status: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "UPDATE api_keys SET status=? WHERE key_id=?", (status, key_id)
            )
            return cur.rowcount > 0

    def update_last_used(self, key_id: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE api_keys SET last_used_at=? WHERE key_id=?",
                (datetime.utcnow().isoformat(), key_id),
            )

    # ── Read operations ───────────────────────────────────────────────────────

    def find_by_id(self, key_id: str) -> Optional[ApiKeyRow]:
        with self._conn() as conn:
            r = conn.execute(
                "SELECT * FROM api_keys WHERE key_id=?", (key_id,)
            ).fetchone()
            return self._row(r) if r else None

    def find_active_by_prefix_start(self, prefix_start: str) -> list[ApiKeyRow]:
        """Return active keys whose prefix starts with the given string.
        Used during authentication to narrow the candidate set before hash comparison."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM api_keys WHERE key_prefix LIKE ? AND status='active'",
                (prefix_start + "%",),
            ).fetchall()
            return [self._row(r) for r in rows]

    def list_all(self) -> list[ApiKeyRow]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM api_keys ORDER BY created_at DESC"
            ).fetchall()
            return [self._row(r) for r in rows]

    def list_by_tenant(self, tenant_id: str) -> list[ApiKeyRow]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM api_keys WHERE tenant_id=? ORDER BY created_at DESC",
                (tenant_id,),
            ).fetchall()
            return [self._row(r) for r in rows]
