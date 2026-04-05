"""
adapters.py — Normalization layer between OpenAI-compatible client payloads
and the upstream China-side inference backend (vLLM / Qwen-VL).

Three main concerns:
  1. adapt_request_to_upstream  — serialize request for upstream
  2. adapt_response_to_openai   — normalize non-streaming upstream response
  3. adapt_model_list_to_openai — normalize upstream model list
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from models import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    Choice,
    ChoiceMessage,
    ModelListResponse,
    ModelObject,
    UsageInfo,
)


# ---------------------------------------------------------------------------
# Request adaptation
# ---------------------------------------------------------------------------


def adapt_request_to_upstream(req: ChatCompletionRequest) -> dict[str, Any]:
    """
    Convert the validated ChatCompletionRequest into a dict suitable for
    forwarding to the upstream vLLM / OpenAI-compatible endpoint.

    Extra fields captured via model_config extra="allow" are included so
    upstream receives any valid OAI parameters we don't explicitly model.
    """
    # Start from the Pydantic model, excluding None values to let upstream
    # apply its own defaults rather than receiving explicit nulls.
    payload = req.model_dump(exclude_none=True)

    # Ensure messages are fully serialized (content parts are dicts)
    payload["messages"] = [
        _serialize_message(m) for m in req.messages
    ]

    return payload


def _serialize_message(message) -> dict[str, Any]:
    """Serialize a ChatMessage, handling both str and list[ContentPart] content."""
    d: dict[str, Any] = {"role": message.role}

    if isinstance(message.content, str):
        d["content"] = message.content
    elif isinstance(message.content, list):
        # Multimodal — each part is a Pydantic model
        d["content"] = [part.model_dump(exclude_none=True) for part in message.content]
    else:
        d["content"] = message.content  # None / passthrough

    if message.name is not None:
        d["name"] = message.name

    # Include any extra fields from model_config extra="allow"
    extra = message.model_extra or {}
    d.update(extra)

    return d


# ---------------------------------------------------------------------------
# Non-streaming response adaptation
# ---------------------------------------------------------------------------


def adapt_response_to_openai(
    upstream_data: dict[str, Any],
    fallback_model: str,
) -> ChatCompletionResponse:
    """
    Normalize an upstream JSON response into a ChatCompletionResponse.

    vLLM typically returns a schema very close to OpenAI's, but we handle
    missing fields gracefully so the gateway doesn't crash on minor deviations.
    """
    resp_id = upstream_data.get("id") or f"chatcmpl-{uuid.uuid4().hex}"
    created = upstream_data.get("created") or int(time.time())
    model = upstream_data.get("model") or fallback_model

    raw_choices = upstream_data.get("choices", [])
    choices: list[Choice] = []
    for i, raw in enumerate(raw_choices):
        raw_msg = raw.get("message", {})
        choices.append(
            Choice(
                index=raw.get("index", i),
                message=ChoiceMessage(
                    role=raw_msg.get("role", "assistant"),
                    content=raw_msg.get("content"),
                ),
                finish_reason=raw.get("finish_reason"),
                logprobs=raw.get("logprobs"),
            )
        )

    # Usage — upstream may or may not return it
    raw_usage = upstream_data.get("usage")
    usage: UsageInfo | None = None
    if raw_usage:
        usage = UsageInfo(
            prompt_tokens=raw_usage.get("prompt_tokens", 0),
            completion_tokens=raw_usage.get("completion_tokens", 0),
            total_tokens=raw_usage.get("total_tokens", 0),
        )

    return ChatCompletionResponse(
        id=resp_id,
        created=created,
        model=model,
        choices=choices,
        usage=usage,
        system_fingerprint=upstream_data.get("system_fingerprint"),
    )


# ---------------------------------------------------------------------------
# Model list adaptation
# ---------------------------------------------------------------------------


def adapt_model_list_to_openai(upstream_data: dict[str, Any]) -> ModelListResponse:
    """
    Normalize an upstream model list response to the OpenAI /v1/models schema.

    Handles cases where upstream returns:
      - {"data": [...]}  — standard OAI-style
      - {"models": [...]} — alternative field name
      - a plain list
    """
    raw_list = (
        upstream_data.get("data")
        or upstream_data.get("models")
        or (upstream_data if isinstance(upstream_data, list) else [])
    )

    models: list[ModelObject] = []
    now = int(time.time())

    for item in raw_list:
        if isinstance(item, str):
            models.append(ModelObject(id=item, created=now))
        elif isinstance(item, dict):
            models.append(
                ModelObject(
                    id=item.get("id", "unknown"),
                    created=item.get("created", now),
                    owned_by=item.get("owned_by", "dcdeeptech"),
                )
            )

    return ModelListResponse(data=models)
