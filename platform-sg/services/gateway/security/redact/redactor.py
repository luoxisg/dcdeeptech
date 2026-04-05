"""
PII Redactor — replaces detected PII tokens with type-labelled placeholders.

Replacements are deterministic and position-based. The original text is
reconstructed in reverse-position order to avoid offset drift.

This is a prototype-level implementation suitable for review and extension.
For production, consider tokenization (reversible redaction) or Presidio anonymizers.
"""

from __future__ import annotations

from security.pii.detector import PiiDetector, PiiFinding

_REPLACEMENTS: dict[str, str] = {
    "email":        "[EMAIL]",
    "phone_sg":     "[PHONE]",
    "phone_cn":     "[PHONE]",
    "nric_sg":      "[NATIONAL_ID]",
    "passport_cn":  "[PASSPORT]",
    "credit_card":  "[CARD]",
    "ip_address":   "[IP]",
    "address_hint": "[ADDRESS]",
}

_DEFAULT_REPLACEMENT = "[REDACTED]"


class Redactor:
    def redact_text(self, text: str, findings: list[PiiFinding]) -> str:
        """
        Replace all PII spans in text with type-labelled placeholders.

        Processes findings in reverse position order so that earlier replacements
        do not shift the indices of later ones.
        """
        if not findings:
            return text

        # Sort by start position descending
        sorted_findings = sorted(findings, key=lambda f: f.start, reverse=True)

        for finding in sorted_findings:
            replacement = _REPLACEMENTS.get(finding.pii_type, _DEFAULT_REPLACEMENT)
            text = text[: finding.start] + replacement + text[finding.end :]

        return text

    def redact_messages(
        self,
        messages: list[dict],
        findings: list[PiiFinding],
    ) -> list[dict]:
        """
        Redact PII from a list of chat messages.

        Re-detects PII per message (the original findings may span the
        concatenated prompt text; per-message re-detection is more precise).
        Returns a new list; original messages are not mutated.
        """
        if not findings:
            return messages

        detector = PiiDetector()
        result: list[dict] = []

        for msg in messages:
            content = msg.get("content")
            if isinstance(content, str) and content:
                msg_result = detector.detect(content)
                redacted_content = self.redact_text(content, msg_result.findings)
                result.append({**msg, "content": redacted_content})
            else:
                result.append(msg)

        return result
