"""
Data breach incident management — PDPA §26D.
Tracks incidents through the mandatory notification workflow:
  detected → assessing → notified_internal → notified_pdpc → notified_affected → closed

PDPA requires notifying PDPC within 3 calendar days of discovering a
significant breach (one that results in, or is likely to result in,
significant harm to affected individuals).
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from .models import _conn, BreachRow

logger = logging.getLogger("compliance.breach")

_VALID_SEVERITIES = {"low", "medium", "high", "critical"}
_TRANSITIONS = {
    "detected":          {"assessing"},
    "assessing":         {"notified_internal"},
    "notified_internal": {"notified_pdpc"},
    "notified_pdpc":     {"notified_affected"},
    "notified_affected": {"closed"},
    "closed":            set(),
}


def create_breach(
    title: str,
    severity: str,
    description: str = "",
    affected_count: int = 0,
) -> BreachRow:
    if severity not in _VALID_SEVERITIES:
        raise ValueError(f"Invalid severity: {severity}")
    now = datetime.now(timezone.utc)
    # PDPA: 3 calendar days to notify PDPC
    pdpc_deadline = now + timedelta(days=3)
    row = BreachRow(
        id=f"breach_{secrets.token_urlsafe(8)}",
        title=title,
        severity=severity,
        status="detected",
        detected_at=now.isoformat(),
        description=description,
        affected_count=affected_count,
        pdpc_deadline=pdpc_deadline.isoformat(),
        notified_pdpc_at=None,
        notified_affected_at=None,
        closed_at=None,
    )
    with _conn() as conn:
        conn.execute(
            """INSERT INTO breach_incidents
               (id, title, severity, status, detected_at, description,
                affected_count, pdpc_deadline)
               VALUES (?,?,?,?,?,?,?,?)""",
            (row.id, row.title, row.severity, row.status, row.detected_at,
             row.description, row.affected_count, row.pdpc_deadline),
        )
    logger.warning(
        "Breach incident created: id=%s severity=%s affected=%d",
        row.id, row.severity, row.affected_count,
    )
    return row


def list_breaches(open_only: bool = False) -> list[BreachRow]:
    with _conn() as conn:
        if open_only:
            rows = conn.execute(
                "SELECT * FROM breach_incidents WHERE status != 'closed' ORDER BY detected_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM breach_incidents ORDER BY detected_at DESC"
            ).fetchall()
    return [BreachRow(**dict(r)) for r in rows]


def advance_status(incident_id: str) -> BreachRow:
    """Move incident to the next workflow step."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM breach_incidents WHERE id=?", (incident_id,)
        ).fetchone()
        if not row:
            raise KeyError(f"Breach incident {incident_id} not found")
        current = row["status"]
        allowed = _TRANSITIONS[current]
        if not allowed:
            raise ValueError(f"Incident {incident_id} is already in terminal state: {current}")
        next_status = next(iter(allowed))
        now = datetime.now(timezone.utc).isoformat()
        patch: dict = {"status": next_status}
        if next_status == "notified_pdpc":
            patch["notified_pdpc_at"] = now
        elif next_status == "notified_affected":
            patch["notified_affected_at"] = now
        elif next_status == "closed":
            patch["closed_at"] = now

        set_clause = ", ".join(f"{k}=?" for k in patch)
        conn.execute(
            f"UPDATE breach_incidents SET {set_clause} WHERE id=?",
            (*patch.values(), incident_id),
        )
        updated = conn.execute(
            "SELECT * FROM breach_incidents WHERE id=?", (incident_id,)
        ).fetchone()
    logger.info("Breach %s advanced: %s → %s", incident_id, current, next_status)
    return BreachRow(**dict(updated))
