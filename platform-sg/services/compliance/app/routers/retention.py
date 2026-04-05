"""
Audit log retention enforcement — PDPA §25.
Deletes audit records older than the configured retention period.
The cleanup itself is written to the audit log (meta-audit).
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

logger = logging.getLogger("compliance.retention")

_CONFIG_PATH = Path(__file__).parent.parent / "config" / "retention_policy.yaml"
_AUDIT_LOG = Path(os.environ.get("AUDIT_LOG_PATH", "audit_logs/audit.jsonl"))


def _load_retention_days() -> int:
    try:
        with open(_CONFIG_PATH) as f:
            cfg = yaml.safe_load(f)
        return int(cfg.get("audit_logs", {}).get("retention_days", 90))
    except Exception:
        return 90  # safe default


def get_status() -> dict:
    """Return retention status metrics for the dashboard."""
    retention_days = _load_retention_days()
    if not _AUDIT_LOG.exists():
        return {
            "policy_days": retention_days,
            "total_audit_records": 0,
            "expired_records": 0,
            "last_cleanup_at": None,
            "next_cleanup_at": datetime.now(timezone.utc).isoformat(),
            "storage_used_kb": 0,
        }

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    total = 0
    expired = 0
    last_cleanup_at = None

    with open(_AUDIT_LOG) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                import json
                record = json.loads(line)
                ts_str = record.get("timestamp", "")
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts < cutoff:
                    expired += 1
                if record.get("event") == "retention_cleanup":
                    last_cleanup_at = ts_str
            except Exception:
                pass

    stat = _AUDIT_LOG.stat()
    return {
        "policy_days": retention_days,
        "total_audit_records": total,
        "expired_records": expired,
        "last_cleanup_at": last_cleanup_at,
        "next_cleanup_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "storage_used_kb": int(stat.st_size / 1024),
    }


def run_cleanup() -> dict:
    """
    Delete audit log lines older than retention_days.
    Rewrites the file in-place (append-only except for this operation).
    Returns a summary dict for the API response.
    """
    retention_days = _load_retention_days()
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    if not _AUDIT_LOG.exists():
        return {"deleted": 0, "retained": 0, "policy_days": retention_days}

    import json
    kept = []
    deleted = 0

    with open(_AUDIT_LOG) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                ts_str = record.get("timestamp", "")
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts < cutoff:
                    deleted += 1
                else:
                    kept.append(line)
            except Exception:
                kept.append(line)  # keep unparseable lines to avoid data loss

    with open(_AUDIT_LOG, "w") as f:
        for line in kept:
            f.write(line + "\n")
        # Meta-audit: the cleanup operation itself is logged
        cleanup_record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "retention_cleanup",
            "deleted_records": deleted,
            "retained_records": len(kept),
            "policy_days": retention_days,
            "cutoff": cutoff.isoformat(),
        }
        f.write(json.dumps(cleanup_record) + "\n")

    logger.info("Retention cleanup: deleted=%d retained=%d", deleted, len(kept))
    return {"deleted": deleted, "retained": len(kept), "policy_days": retention_days}
