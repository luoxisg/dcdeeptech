"""
Audit Logger — writes metadata-only records for every inference request.

SECURITY CONTRACT (enforced here):
  - Raw prompts are NEVER written to audit records
  - Full API keys are NEVER written — only key_id and key_prefix
  - PII matches are NEVER written — only the prompt_hash (SHA-256)
  - Fields explicitly blocked from logging are listed in _BLOCKED_FIELDS

Each audit record is a single JSON line written to the "audit" logger,
which is wired to audit_logs/audit.jsonl in app/main.py.

Schema fields per event:
  request_id       — UUID per HTTP request
  tenant_id        — resolved tenant
  key_id           — DCDeepTech key ID (not the key itself)
  purpose          — caller-supplied intent label
  model            — model name requested
  data_class       — PII classification result
  redaction_applied — whether PII was redacted before dispatch
  prompt_hash      — SHA-256 of original prompt (safe for correlation)
  destination_region — "sg" | "cq" | "blocked"
  route_name       — policy rule name applied
  result_status    — HTTP status code of the outcome
  timestamp        — ISO-8601 UTC
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("audit")

# Fields that must never appear in audit records
_BLOCKED_FIELDS = frozenset({
    "messages",
    "raw_prompt",
    "prompt",
    "key",
    "api_key",
    "authorization",
    "pii_matches",
    "findings",
})


class AuditLogger:
    def log(self, event: dict[str, Any]) -> None:
        """
        Write a sanitised audit record.

        The method is intentionally strict: any field in _BLOCKED_FIELDS
        is silently dropped before writing. This prevents accidental
        prompt or key leakage if callers add extra fields.
        """
        safe = {k: v for k, v in event.items() if k.lower() not in _BLOCKED_FIELDS}

        # Ensure required fields are present (use sentinel values if missing)
        required = ("request_id", "tenant_id", "key_id", "timestamp")
        for field in required:
            if field not in safe:
                safe[field] = "MISSING"

        logger.info(json.dumps(safe, default=str))
