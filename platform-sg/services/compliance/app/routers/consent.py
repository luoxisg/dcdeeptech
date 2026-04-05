"""
Consent record service — PDPA §13-17.
Records explicit consent grants and withdrawals.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional

from .models import _conn, ConsentRow

_VALID_BASES = {"explicit", "legitimate_interest", "contractual", "withdrawn"}


def record_consent(
    tenant_id: str,
    subject_email: str,
    purpose: str,
    basis: str,
    granted: bool,
    expires_at: Optional[str] = None,
) -> ConsentRow:
    if basis not in _VALID_BASES:
        raise ValueError(f"Invalid consent basis: {basis}")
    now = datetime.now(timezone.utc).isoformat()
    row = ConsentRow(
        id=f"consent_{secrets.token_urlsafe(8)}",
        tenant_id=tenant_id,
        subject_email=subject_email,
        purpose=purpose,
        basis=basis,
        granted=granted,
        recorded_at=now,
        expires_at=expires_at,
        withdrawn_at=None,
    )
    with _conn() as conn:
        conn.execute(
            """INSERT INTO consent_records
               (id, tenant_id, subject_email, purpose, basis,
                granted, recorded_at, expires_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (row.id, row.tenant_id, row.subject_email, row.purpose,
             row.basis, int(row.granted), row.recorded_at, row.expires_at),
        )
    return row


def withdraw_consent(record_id: str) -> ConsentRow:
    """Mark a consent record as withdrawn — creates an immutable audit trail."""
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "UPDATE consent_records SET granted=0, basis='withdrawn', withdrawn_at=? WHERE id=?",
            (now, record_id),
        )
        row = conn.execute(
            "SELECT * FROM consent_records WHERE id=?", (record_id,)
        ).fetchone()
        if not row:
            raise KeyError(f"Consent record {record_id} not found")
    r = dict(row)
    r["granted"] = bool(r["granted"])
    return ConsentRow(**r)


def list_consent(
    tenant_id: Optional[str] = None,
    subject_email: Optional[str] = None,
) -> list[ConsentRow]:
    with _conn() as conn:
        if tenant_id and subject_email:
            rows = conn.execute(
                "SELECT * FROM consent_records WHERE tenant_id=? AND subject_email=? ORDER BY recorded_at DESC",
                (tenant_id, subject_email),
            ).fetchall()
        elif tenant_id:
            rows = conn.execute(
                "SELECT * FROM consent_records WHERE tenant_id=? ORDER BY recorded_at DESC",
                (tenant_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM consent_records ORDER BY recorded_at DESC"
            ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["granted"] = bool(d["granted"])
        result.append(ConsentRow(**d))
    return result
