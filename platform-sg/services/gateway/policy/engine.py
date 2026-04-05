"""
Policy Engine — decides whether a request is allowed and where it should be routed.

Reads rules from config/transfer_rules.yaml.
Falls back to safe defaults (deny anything not explicitly allowed) if config is missing.

Decision output:
  allow              — True / False
  destination_region — "sg" | "cq" | "blocked"
  route_name         — label used in audit log and X-Route-Name header
  requires_redaction — hint to caller (may already be applied upstream)
  deny_reason        — human-readable message returned to client on deny
  audit_required     — always True in this prototype
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

_CONFIG_DIR = Path(os.getenv("CONFIG_DIR", "config/"))


@dataclass
class PolicyDecision:
    allow: bool
    destination_region: str   # "sg" | "cq" | "blocked"
    route_name: str
    requires_redaction: bool
    deny_reason: Optional[str]
    audit_required: bool = True


class PolicyEngine:
    def __init__(self, rules_path: Optional[Path] = None):
        path = rules_path or (_CONFIG_DIR / "transfer_rules.yaml")
        self._rules: list[dict] = self._load(path)

    def _load(self, path: Path) -> list[dict]:
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                rules = data.get("rules", [])
                logger.info("policy.rules_loaded count=%d path=%s", len(rules), path)
                return rules
        logger.warning("policy.config_missing path=%s — using built-in defaults", path)
        return self._defaults()

    @staticmethod
    def _defaults() -> list[dict]:
        """Safe fallback: anything beyond LOW_RISK stays in SG; HIGH_RISK is blocked."""
        return [
            {"data_class": "PUBLIC",    "allow": True,  "destination": "cq", "route": "cq-default", "requires_redaction": False},
            {"data_class": "LOW_RISK",  "allow": True,  "destination": "cq", "route": "cq-default", "requires_redaction": False},
            {"data_class": "PERSONAL",  "allow": True,  "destination": "sg", "route": "sg-redacted", "requires_redaction": True},
            {"data_class": "HIGH_RISK", "allow": False, "destination": "blocked", "route": "denied",
             "deny_reason": "HIGH_RISK data is not permitted for cross-border inference"},
        ]

    def evaluate(
        self,
        tenant_id: str,
        purpose: str,
        data_class: str,
        model: str,
    ) -> PolicyDecision:
        """
        Evaluate policy for an incoming inference request.

        Current logic: data_class is the primary decision axis.
        Future: extend to per-tenant overrides, model allowlist, purpose classification.
        """
        for rule in self._rules:
            if rule.get("data_class") != data_class:
                continue

            allowed = bool(rule.get("allow", False))
            if not allowed:
                return PolicyDecision(
                    allow=False,
                    destination_region="blocked",
                    route_name=rule.get("route", "denied"),
                    requires_redaction=False,
                    deny_reason=rule.get(
                        "deny_reason",
                        f"Data class '{data_class}' is not permitted for inference",
                    ),
                )

            return PolicyDecision(
                allow=True,
                destination_region=rule.get("destination", "sg"),
                route_name=rule.get("route", "default"),
                requires_redaction=bool(rule.get("requires_redaction", False)),
                deny_reason=None,
            )

        # No matching rule — default deny
        logger.warning(
            "policy.no_rule_match data_class=%s tenant=%s", data_class, tenant_id
        )
        return PolicyDecision(
            allow=False,
            destination_region="blocked",
            route_name="no-rule",
            requires_redaction=False,
            deny_reason=f"No policy rule found for data class '{data_class}'",
        )
