"""
tests/test_adapters.py — Unit tests for the adapters module.

These tests are pure unit tests — no HTTP involved — so they run
fast and catch normalization regressions early.
"""

import time
import pytest

from adapters import (
    adapt_model_list_to_openai,
    adapt_request_to_upstream,
    adapt_response_to_openai,
)
from models import (
    ChatCompletionRequest,
    ChatMessage,
    ImageURL,
    ImageURLContentPart,
    TextContentPart,
)


# ---------------------------------------------------------------------------
# adapt_request_to_upstream
# ---------------------------------------------------------------------------


def test_adapt_request_plain_text():
    req = ChatCompletionRequest(
        model="qwenvl",
        messages=[ChatMessage(role="user", content="Hello")],
    )
    payload = adapt_request_to_upstream(req)
    assert payload["model"] == "qwenvl"
    assert payload["messages"][0]["role"] == "user"
    assert payload["messages"][0]["content"] == "Hello"


def test_adapt_request_multimodal():
    req = ChatCompletionRequest(
        model="qwenvl",
        messages=[
            ChatMessage(
                role="user",
                content=[
                    ImageURLContentPart(
                        type="image_url",
                        image_url=ImageURL(url="https://example.com/img.png"),
                    ),
                    TextContentPart(type="text", text="Describe this."),
                ],
            )
        ],
    )
    payload = adapt_request_to_upstream(req)
    content = payload["messages"][0]["content"]
    assert isinstance(content, list)
    assert content[0]["type"] == "image_url"
    assert content[0]["image_url"]["url"] == "https://example.com/img.png"
    assert content[1]["type"] == "text"
    assert content[1]["text"] == "Describe this."


def test_adapt_request_excludes_none_fields():
    """None fields should not be sent to upstream (let it use its own defaults)."""
    req = ChatCompletionRequest(
        model="qwenvl",
        messages=[ChatMessage(role="user", content="hi")],
        temperature=None,
        max_tokens=None,
    )
    payload = adapt_request_to_upstream(req)
    assert "temperature" not in payload
    assert "max_tokens" not in payload


def test_adapt_request_includes_explicit_fields():
    req = ChatCompletionRequest(
        model="qwenvl",
        messages=[ChatMessage(role="user", content="hi")],
        temperature=0.5,
        max_tokens=200,
        stream=True,
    )
    payload = adapt_request_to_upstream(req)
    assert payload["temperature"] == 0.5
    assert payload["max_tokens"] == 200
    assert payload["stream"] is True


def test_adapt_request_system_message():
    req = ChatCompletionRequest(
        model="qwenvl",
        messages=[
            ChatMessage(role="system", content="You are helpful."),
            ChatMessage(role="user", content="Hello"),
        ],
    )
    payload = adapt_request_to_upstream(req)
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][1]["role"] == "user"


# ---------------------------------------------------------------------------
# adapt_response_to_openai
# ---------------------------------------------------------------------------


def test_adapt_response_full():
    upstream = {
        "id": "chatcmpl-xyz",
        "created": 1710000000,
        "model": "qwenvl",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Hi there!"},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
    }
    result = adapt_response_to_openai(upstream, fallback_model="default")
    assert result.id == "chatcmpl-xyz"
    assert result.model == "qwenvl"
    assert result.choices[0].message.content == "Hi there!"
    assert result.choices[0].finish_reason == "stop"
    assert result.usage.total_tokens == 8


def test_adapt_response_generates_fallback_id():
    upstream = {
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}
        ]
    }
    result = adapt_response_to_openai(upstream, fallback_model="qwenvl")
    assert result.id.startswith("chatcmpl-")
    assert result.model == "qwenvl"


def test_adapt_response_generates_created_timestamp():
    upstream = {
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}
        ]
    }
    before = int(time.time())
    result = adapt_response_to_openai(upstream, fallback_model="qwenvl")
    after = int(time.time())
    assert before <= result.created <= after


def test_adapt_response_handles_missing_usage():
    upstream = {
        "id": "chatcmpl-nousage",
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}
        ],
    }
    result = adapt_response_to_openai(upstream, fallback_model="qwenvl")
    assert result.usage is None


def test_adapt_response_multiple_choices():
    upstream = {
        "id": "chatcmpl-multi",
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": "A"}, "finish_reason": "stop"},
            {"index": 1, "message": {"role": "assistant", "content": "B"}, "finish_reason": "stop"},
        ],
    }
    result = adapt_response_to_openai(upstream, fallback_model="qwenvl")
    assert len(result.choices) == 2
    assert result.choices[1].message.content == "B"


# ---------------------------------------------------------------------------
# adapt_model_list_to_openai
# ---------------------------------------------------------------------------


def test_adapt_model_list_standard_data_key():
    upstream = {
        "object": "list",
        "data": [
            {"id": "qwenvl", "created": 1710000000, "owned_by": "sophnet"},
        ],
    }
    result = adapt_model_list_to_openai(upstream)
    assert result.object == "list"
    assert len(result.data) == 1
    assert result.data[0].id == "qwenvl"
    assert result.data[0].owned_by == "sophnet"


def test_adapt_model_list_models_key_fallback():
    """Handles upstream using `models` instead of `data`."""
    upstream = {
        "models": [{"id": "qwen2", "owned_by": "sophnet"}]
    }
    result = adapt_model_list_to_openai(upstream)
    assert result.data[0].id == "qwen2"


def test_adapt_model_list_string_ids():
    """Handles upstream returning a list of plain strings."""
    upstream = {"data": ["qwenvl", "qwen2"]}
    result = adapt_model_list_to_openai(upstream)
    ids = [m.id for m in result.data]
    assert "qwenvl" in ids
    assert "qwen2" in ids


def test_adapt_model_list_empty():
    result = adapt_model_list_to_openai({"data": []})
    assert result.data == []
    assert result.object == "list"
