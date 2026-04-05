"""
PII Detector — classifies prompt text and identifies sensitive data patterns.

Detection uses compiled regex patterns. No ML model is required for this prototype,
making it fast and predictable. Add ML-based detection (Presidio, GLiNER) later
without changing the PiiDetectionResult interface.

Data classes (in ascending sensitivity):
  PUBLIC    — no PII detected
  LOW_RISK  — low-sensitivity identifiers (IP addresses, generic numbers)
  PERSONAL  — identifiable personal data (email, phone, name hints, address)
  HIGH_RISK — highly regulated data (national ID, passport, credit card, health)

IMPORTANT: PiiFinding.match is intentionally NOT logged or stored anywhere.
Only the prompt_hash (SHA-256) is persisted for correlation.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import NamedTuple


class _Rule(NamedTuple):
    pattern: re.Pattern
    data_class: str


# ── Pattern definitions ────────────────────────────────────────────────────────
# Each entry: (compiled_regex, data_class_it_triggers)

_RULES: dict[str, _Rule] = {
    "email": _Rule(
        re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
        "PERSONAL",
    ),
    "phone_sg": _Rule(
        re.compile(r"(?<!\d)(\+65[\s\-]?)?\d{4}[\s\-]?\d{4}(?!\d)"),
        "PERSONAL",
    ),
    "phone_cn": _Rule(
        re.compile(r"(?:\+86[\s\-]?)?1[3-9]\d{9}(?!\d)"),
        "PERSONAL",
    ),
    "nric_sg": _Rule(
        re.compile(r"\b[STFG]\d{7}[A-Z]\b"),
        "HIGH_RISK",
    ),
    "passport_cn": _Rule(
        re.compile(r"\b[A-Z]{1,2}\d{7,8}\b"),
        "HIGH_RISK",
    ),
    "credit_card": _Rule(
        re.compile(r"\b(?:\d{4}[\s\-]?){3}\d{4}\b"),
        "HIGH_RISK",
    ),
    "ip_address": _Rule(
        re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"),
        "LOW_RISK",
    ),
    "address_hint": _Rule(
        re.compile(
            r"\b(?:No\.\s*\d+|Blk\s*\d+|Block\s*\d+|\d+\s+\w+\s+(?:Road|Street|Ave|Drive|Lane|Close|Crescent|Way))\b",
            re.IGNORECASE,
        ),
        "PERSONAL",
    ),
}

_CLASS_RANK: dict[str, int] = {
    "PUBLIC": 0,
    "LOW_RISK": 1,
    "PERSONAL": 2,
    "HIGH_RISK": 3,
}


@dataclass
class PiiFinding:
    pii_type: str
    # NOTE: match value is intentionally not logged anywhere
    match: str = field(repr=False)
    start: int
    end: int


@dataclass
class PiiDetectionResult:
    data_class: str             # highest-rank class found
    requires_redaction: bool    # True for PERSONAL and above
    findings: list[PiiFinding]  # full list — used by redactor, not logged
    prompt_hash: str            # SHA-256 of input text — safe for audit logs
    has_pii: bool


class PiiDetector:
    def detect(self, text: str) -> PiiDetectionResult:
        """
        Scan text for PII patterns. Returns classification and all findings.
        The findings list is passed to the Redactor; the raw matches are
        never written to logs or audit records.
        """
        if not text:
            return PiiDetectionResult(
                data_class="PUBLIC",
                requires_redaction=False,
                findings=[],
                prompt_hash=_sha256(text),
                has_pii=False,
            )

        findings: list[PiiFinding] = []
        highest_rank = 0
        highest_class = "PUBLIC"

        for pii_type, rule in _RULES.items():
            for m in rule.pattern.finditer(text):
                findings.append(
                    PiiFinding(
                        pii_type=pii_type,
                        match=m.group(),
                        start=m.start(),
                        end=m.end(),
                    )
                )
                rank = _CLASS_RANK.get(rule.data_class, 0)
                if rank > highest_rank:
                    highest_rank = rank
                    highest_class = rule.data_class

        return PiiDetectionResult(
            data_class=highest_class,
            requires_redaction=highest_rank >= _CLASS_RANK["PERSONAL"],
            findings=findings,
            prompt_hash=_sha256(text),
            has_pii=len(findings) > 0,
        )


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()
