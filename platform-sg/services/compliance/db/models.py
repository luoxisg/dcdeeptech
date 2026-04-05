"""
SQLite schema and dataclasses for PDPA compliance records.
All tables use WAL mode (inherited from keys DB connection pattern).
"""
import sqlite3
import os
from dataclasses import dataclass
from typing import Optional

_DB_PATH = os.environ.get("COMPLIANCE_DB_PATH", "compliance.db")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema() -> None:
    with _conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS dsar_requests (
            id             TEXT PRIMARY KEY,
            type           TEXT NOT NULL,
            subject_name   TEXT NOT NULL,
            subject_email  TEXT NOT NULL,
            tenant_id      TEXT NOT NULL,
            description    TEXT NOT NULL DEFAULT '',
            status         TEXT NOT NULL DEFAULT 'pending',
            submitted_at   TEXT NOT NULL,
            due_at         TEXT NOT NULL,
            resolved_at    TEXT,
            notes          TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_dsar_tenant  ON dsar_requests(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_dsar_status  ON dsar_requests(status);

        CREATE TABLE IF NOT EXISTS consent_records (
            id             TEXT PRIMARY KEY,
            tenant_id      TEXT NOT NULL,
            subject_email  TEXT NOT NULL,
            purpose        TEXT NOT NULL,
            basis          TEXT NOT NULL,
            granted        INTEGER NOT NULL DEFAULT 1,
            recorded_at    TEXT NOT NULL,
            expires_at     TEXT,
            withdrawn_at   TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_consent_tenant  ON consent_records(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_consent_subject ON consent_records(subject_email);

        CREATE TABLE IF NOT EXISTS breach_incidents (
            id                   TEXT PRIMARY KEY,
            title                TEXT NOT NULL,
            severity             TEXT NOT NULL,
            status               TEXT NOT NULL DEFAULT 'detected',
            detected_at          TEXT NOT NULL,
            description          TEXT NOT NULL DEFAULT '',
            affected_count       INTEGER NOT NULL DEFAULT 0,
            pdpc_deadline        TEXT NOT NULL,
            notified_pdpc_at     TEXT,
            notified_affected_at TEXT,
            closed_at            TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_breach_status ON breach_incidents(status);
        """)


@dataclass
class DsarRow:
    id: str
    type: str
    subject_name: str
    subject_email: str
    tenant_id: str
    description: str
    status: str
    submitted_at: str
    due_at: str
    resolved_at: Optional[str]
    notes: str


@dataclass
class ConsentRow:
    id: str
    tenant_id: str
    subject_email: str
    purpose: str
    basis: str
    granted: bool
    recorded_at: str
    expires_at: Optional[str]
    withdrawn_at: Optional[str]


@dataclass
class BreachRow:
    id: str
    title: str
    severity: str
    status: str
    detected_at: str
    description: str
    affected_count: int
    pdpc_deadline: str
    notified_pdpc_at: Optional[str]
    notified_affected_at: Optional[str]
    closed_at: Optional[str]
