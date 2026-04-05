"""
models.py — Pydantic models for OpenAI-compatible request/response schemas.

Supports both plain-text and multimodal (Qwen-VL image_url) message content.
Extra fields are allowed and forwarded to upstream so we don't silently drop
valid OpenAI parameters (temperature, top_p, stop, etc.).
"""

from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Message content parts (multimodal)
# ---------------------------------------------------------------------------


class TextContentPart(BaseModel):
    type: Literal["text"]
    text: str


class ImageURL(BaseModel):
    url: str
    detail: str | None = None  # "auto" | "low" | "high"


class ImageURLContentPart(BaseModel):
    type: Literal["image_url"]
    image_url: ImageURL


ContentPart = Union[TextContentPart, ImageURLContentPart]


# ---------------------------------------------------------------------------
# Chat message
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "function"]
    # content can be a plain string or a list of content parts (multimodal)
    content: Union[str, list[ContentPart], None] = None
    name: str | None = None

    model_config = {"extra": "allow"}


# ---------------------------------------------------------------------------
# Chat completion request
# ---------------------------------------------------------------------------


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False

    # Common generation parameters — keep optional so upstream defaults apply
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    stop: Union[str, list[str], None] = None
    n: int | None = None
    presence_penalty: float | None = None
    frequency_penalty: float | None = None
    user: str | None = None

    model_config = {"extra": "allow"}  # pass through any other OAI fields


# ---------------------------------------------------------------------------
# Response models (for non-streaming)
# ---------------------------------------------------------------------------


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChoiceDelta(BaseModel):
    role: str | None = None
    content: str | None = None


class ChoiceMessage(BaseModel):
    role: str
    content: str | None = None


class Choice(BaseModel):
    index: int
    message: ChoiceMessage
    finish_reason: str | None = None
    logprobs: Any | None = None


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[Choice]
    usage: UsageInfo | None = None
    system_fingerprint: str | None = None


# ---------------------------------------------------------------------------
# Model listing
# ---------------------------------------------------------------------------


class ModelObject(BaseModel):
    id: str
    object: str = "model"
    created: int = Field(default=0)
    owned_by: str = "dcdeeptech"


class ModelListResponse(BaseModel):
    object: str = "list"
    data: list[ModelObject]
