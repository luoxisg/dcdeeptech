"""
Main inference proxy router.

Implements the full request chain:
  authenticate → detect PII → redact → evaluate policy → dispatch → audit

Endpoint: POST /v1/chat/completions  (OpenAI-compatible)
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from gateway.auth.tenant_auth import require_auth
from gateway.policy.engine import PolicyEngine
from gateway.routing.dispatcher import Dispatcher
from security.pii.detector import PiiDetector
from security.redact.redactor import Redactor
from audit.audit_logger import AuditLogger

router = APIRouter()
logger = logging.getLogger(__name__)

# Module-level singletons — created once per process
_pii_detector = PiiDetector()
_redactor = Redactor()
_policy_engine = PolicyEngine()
_dispatcher = Dispatcher()
_audit = AuditLogger()


@router.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    tenant: dict = Depends(require_auth),
):
    """
    OpenAI-compatible chat completions endpoint.
    Validates DCDeepTech API key, applies policy, routes to SG or CQ backend.
    """
    request_id = str(uuid.uuid4())
    body = await request.json()

    messages: list = body.get("messages", [])
    model: str = body.get("model", "unknown")
    purpose: str = body.get("purpose", "general")  # caller-supplied intent hint

    # ── 1. PII Detection ─────────────────────────────────────────────────────
    prompt_text = " ".join(m.get("content", "") for m in messages if isinstance(m.get("content"), str))
    pii_result = _pii_detector.detect(prompt_text)

    # ── 2. Redact if required ─────────────────────────────────────────────────
    redaction_applied = False
    processed_messages = messages
    if pii_result.requires_redaction:
        processed_messages = _redactor.redact_messages(messages, pii_result.findings)
        redaction_applied = True
        logger.info(
            "proxy.redacted",
            extra={
                "request_id": request_id,
                "data_class": pii_result.data_class,
                "finding_count": len(pii_result.findings),
            },
        )

    # ── 3. Policy evaluation ──────────────────────────────────────────────────
    policy = _policy_engine.evaluate(
        tenant_id=tenant["tenant_id"],
        purpose=purpose,
        data_class=pii_result.data_class,
        model=model,
    )

    if not policy.allow:
        _audit.log({
            "request_id": request_id,
            "tenant_id": tenant["tenant_id"],
            "key_id": tenant["key_id"],
            "purpose": purpose,
            "model": model,
            "data_class": pii_result.data_class,
            "redaction_applied": redaction_applied,
            "prompt_hash": pii_result.prompt_hash,
            "destination_region": "blocked",
            "route_name": "denied",
            "result_status": 403,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=403, detail=policy.deny_reason or "Policy denied")

    # ── 4. Dispatch ───────────────────────────────────────────────────────────
    try:
        response_body = await _dispatcher.dispatch(
            messages=processed_messages,
            model=model,
            body=body,
            destination=policy.destination_region,
            route_name=policy.route_name,
        )
    except Exception as exc:
        logger.error("proxy.dispatch_error", extra={"request_id": request_id, "error": str(exc)})
        _audit.log({
            "request_id": request_id,
            "tenant_id": tenant["tenant_id"],
            "key_id": tenant["key_id"],
            "purpose": purpose,
            "model": model,
            "data_class": pii_result.data_class,
            "redaction_applied": redaction_applied,
            "prompt_hash": pii_result.prompt_hash,
            "destination_region": policy.destination_region,
            "route_name": policy.route_name,
            "result_status": 502,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=502, detail="Upstream inference error") from exc

    # ── 5. Audit ──────────────────────────────────────────────────────────────
    _audit.log({
        "request_id": request_id,
        "tenant_id": tenant["tenant_id"],
        "key_id": tenant["key_id"],
        "purpose": purpose,
        "model": model,
        "data_class": pii_result.data_class,
        "redaction_applied": redaction_applied,
        "prompt_hash": pii_result.prompt_hash,
        "destination_region": policy.destination_region,
        "route_name": policy.route_name,
        "result_status": 200,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return response_body
