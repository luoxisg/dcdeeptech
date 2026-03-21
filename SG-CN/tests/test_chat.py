"""
tests/test_chat.py — Tests for POST /v1/chat/completions

Covers: text messages, multimodal, streaming, error propagation,
upstream timeout, request forwarding correctness.
"""

import json
import pytest
import respx
import httpx


UPSTREAM_CHAT_URL = "https://fake-upstream.example.com/v1/chat/completions"

UPSTREAM_RESPONSE = {
    "id": "chatcmpl-abc123",
    "object": "chat.completion",
    "created": 1710000000,
    "model": "qwenvl",
    "choices": [
        {
            "index": 0,
            "message": {"role": "assistant", "content": "Hello! How can I help?"},
            "finish_reason": "stop",
        }
    ],
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 8,
        "total_tokens": 18,
    },
}


# ---------------------------------------------------------------------------
# Non-streaming
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_chat_text_message(client, auth_headers):
    """Basic text message returns normalized OpenAI response."""
    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            return_value=httpx.Response(200, json=UPSTREAM_RESPONSE)
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "qwenvl",
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "chat.completion"
    assert body["id"] == "chatcmpl-abc123"
    assert body["choices"][0]["message"]["content"] == "Hello! How can I help?"
    assert body["usage"]["total_tokens"] == 18


@pytest.mark.anyio
async def test_chat_preserves_model_name(client, auth_headers):
    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            return_value=httpx.Response(200, json=UPSTREAM_RESPONSE)
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={"model": "qwenvl", "messages": [{"role": "user", "content": "hi"}]},
        )

    assert resp.json()["model"] == "qwenvl"


@pytest.mark.anyio
async def test_chat_generates_fallback_id_when_missing(client, auth_headers):
    """If upstream omits `id`, the gateway generates one."""
    upstream_no_id = {**UPSTREAM_RESPONSE}
    del upstream_no_id["id"]

    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            return_value=httpx.Response(200, json=upstream_no_id)
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={"model": "qwenvl", "messages": [{"role": "user", "content": "hi"}]},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"].startswith("chatcmpl-")


@pytest.mark.anyio
async def test_chat_forwards_temperature(client, auth_headers):
    """Extra generation parameters must be forwarded to upstream."""
    captured = {}

    def capture_request(request):
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=UPSTREAM_RESPONSE)

    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(side_effect=capture_request)
        await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "qwenvl",
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
            },
        )

    assert captured["body"]["temperature"] == 0.7
    assert captured["body"]["max_tokens"] == 512


@pytest.mark.anyio
async def test_chat_upstream_timeout_returns_504(client, auth_headers):
    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={"model": "qwenvl", "messages": [{"role": "user", "content": "hi"}]},
        )

    assert resp.status_code == 504


@pytest.mark.anyio
async def test_chat_upstream_502_propagated(client, auth_headers):
    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            return_value=httpx.Response(502, json={"error": "bad gateway"})
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={"model": "qwenvl", "messages": [{"role": "user", "content": "hi"}]},
        )

    assert resp.status_code == 502


@pytest.mark.anyio
async def test_chat_upstream_401_returns_502(client, auth_headers):
    """Upstream auth failure should surface as a 502, not a 401 to the client."""
    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            return_value=httpx.Response(401, json={"error": "unauthorized"})
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={"model": "qwenvl", "messages": [{"role": "user", "content": "hi"}]},
        )

    assert resp.status_code == 502


# ---------------------------------------------------------------------------
# Multimodal
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_chat_multimodal_image_url(client, auth_headers):
    """Multimodal message with image_url content part is accepted and forwarded."""
    captured = {}

    def capture_request(request):
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=UPSTREAM_RESPONSE)

    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(side_effect=capture_request)
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "qwenvl",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": "https://example.com/img.png"},
                            },
                            {"type": "text", "text": "What is in this image?"},
                        ],
                    }
                ],
            },
        )

    assert resp.status_code == 200
    # Upstream should have received the content parts as a list
    msg = captured["body"]["messages"][0]
    assert isinstance(msg["content"], list)
    assert msg["content"][0]["type"] == "image_url"
    assert msg["content"][1]["type"] == "text"


@pytest.mark.anyio
async def test_chat_system_message(client, auth_headers):
    """System messages are forwarded correctly."""
    captured = {}

    def capture_request(request):
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=UPSTREAM_RESPONSE)

    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(side_effect=capture_request)
        await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "qwenvl",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello"},
                ],
            },
        )

    msgs = captured["body"]["messages"]
    assert msgs[0]["role"] == "system"
    assert msgs[0]["content"] == "You are a helpful assistant."


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_chat_streaming_response_content_type(client, auth_headers):
    """Streaming response must have text/event-stream content type."""
    sse_chunks = [
        b'data: {"id":"x","choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n',
        b"data: [DONE]\n\n",
    ]

    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            return_value=httpx.Response(
                200,
                content=b"".join(sse_chunks),
                headers={"content-type": "text/event-stream"},
            )
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "qwenvl",
                "stream": True,
                "messages": [{"role": "user", "content": "hi"}],
            },
        )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]


@pytest.mark.anyio
async def test_chat_streaming_timeout_yields_error_event(client, auth_headers):
    """Upstream timeout during stream should yield an SSE error event, not crash."""
    with respx.mock:
        respx.post(UPSTREAM_CHAT_URL).mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        resp = await client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "qwenvl",
                "stream": True,
                "messages": [{"role": "user", "content": "hi"}],
            },
        )

    # Should still return 200 with SSE content containing error
    assert resp.status_code == 200
    assert b"error" in resp.content


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_chat_missing_messages_returns_422(client, auth_headers):
    """Pydantic validation: missing required `messages` field."""
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers,
        json={"model": "qwenvl"},
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_chat_missing_model_returns_422(client, auth_headers):
    """Pydantic validation: missing required `model` field."""
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers,
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 422
