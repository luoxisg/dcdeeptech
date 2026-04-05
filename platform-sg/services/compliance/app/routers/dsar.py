"""
DSAR (Data Subject Access Request) service.
Handles create, list, status transitions for PDPA §21-22 compliance.
"""
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from .models import _conn, DsarRow

_VALID_TYPES = {"access", "correction", "deletion", "withdrawal"}
_VALID_STATUSES = {"pending", "verifying", "processing", "completed", "rejected"}
# State machine — only forward transitions allowed
_TRANSITIONS = {
    "pending":    {"verifying", "rejected"},
    "verifying":  {"processing", "rejected"},
    "processing": {"completed", "rejected"},
    "completed":  set(),
    "rejected":   set(),
}


def create_dsar(
    type_: str,
    subject_name: str,
    subject_email: str,
    tenant_id: str,
    description: str = "",
) -> DsarRow:
    if type_ not in _VALID_TYPES:
        raise ValueError(f"Invalid DSAR type: {type_}")
    now = datetime.now(timezone.utc)
    # PDPA requires response within 30 days
    due = now + timedelta(days=30)
    row = DsarRow(
        id=f"dsar_{secrets.token_urlsafe(8)}",
        type=type_,
        subject_name=subject_name,
        subject_email=subject_email,
        tenant_id=tenant_id,
        description=description,
        status="pending",
        submitted_at=now.isoformat(),
        due_at=due.isoformat(),
        resolved_at=None,
        notes="",
    )
    with _conn() as conn:
        conn.execute(
            """INSERT INTO dsar_requests
               (id, type, subject_name, subject_email, tenant_id,
                description, status, submitted_at, due_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (row.id, row.type, row.subject_name, row.subject_email,
             row.tenant_id, row.description, row.status,
             row.submitted_at, row.due_at),
        )
    return row


def list_dsars(tenant_id: Optional[str] = None) -> list[DsarRow]:
    with _conn() as conn:
        if tenant_id:
            rows = conn.execute(
                "SELECT * FROM dsar_requests WHERE tenant_id=? ORDER BY submitted_at DESC",
                (tenant_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM dsar_requests ORDER BY submitted_at DESC"
            ).fetchall()
    return [DsarRow(**dict(r)) for r in rows]


def update_status(dsar_id: str, new_status: str, notes: str = "") -> DsarRow:
    if new_status not in _VALID_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM dsar_requests WHERE id=?", (dsar_id,)
        ).fetchone()
        if not row:
            raise KeyError(f"DSAR {dsar_id} not found")
        current = row["status"]
        if new_status not in _TRANSITIONS[current]:
            raise ValueError(f"Cannot transition {current} → {new_status}")
        resolved_at = (
            datetime.now(timezone.utc).isoformat()
            if new_status in ("completed", "rejected")
            else None
        )
        conn.execute(
            "UPDATE dsar_requests SET status=?, notes=?, resolved_at=? WHERE id=?",
            (new_status, notes or row["notes"], resolved_at, dsar_id),
        )
        updated = conn.execute(
            "SELECT * FROM dsar_requests WHERE id=?", (dsar_id,)
        ).fetchone()
    return DsarRow(**dict(updated))
