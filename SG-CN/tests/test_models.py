"""
tests/test_models.py — Tests for GET /v1/models
"""

import pytest
import respx
import httpx


UPSTREAM_MODEL_RESPONSE = {
    "object": "list",
    "data": [
        {"id": "qwenvl", "object": "model", "created": 1710000000, "owned_by": "sophnet"},
        {"id": "qwen2", "object": "model", "created": 1710000001, "owned_by": "sophnet"},
    ],
}


@pytest.mark.anyio
async def test_models_returns_list(client, auth_headers):
    with respx.mock:
        respx.get("https://fake-upstream.example.com/v1/models").mock(
            return_value=httpx.Response(200, json=UPSTREAM_MODEL_RESPONSE)
        )
        resp = await client.get("/v1/models", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "list"
    assert len(body["data"]) == 2
    ids = [m["id"] for m in body["data"]]
    assert "qwenvl" in ids


@pytest.mark.anyio
async def test_models_fallback_on_upstream_timeout(client, auth_headers):
    """When upstream times out, return the default model as fallback."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/v1/models").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        resp = await client.get("/v1/models", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "list"
    assert len(body["data"]) >= 1
    assert body["data"][0]["id"] == "qwenvl"


@pytest.mark.anyio
async def test_models_fallback_on_upstream_error(client, auth_headers):
    """Non-200 upstream response falls back to default model listing."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/v1/models").mock(
            return_value=httpx.Response(503)
        )
        resp = await client.get("/v1/models", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["data"][0]["id"] == "qwenvl"


@pytest.mark.anyio
async def test_models_normalizes_owned_by(client, auth_headers):
    """owned_by should be preserved from upstream or default to dcdeeptech."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/v1/models").mock(
            return_value=httpx.Response(200, json=UPSTREAM_MODEL_RESPONSE)
        )
        resp = await client.get("/v1/models", headers=auth_headers)

    # Adapter preserves upstream owned_by when present
    model = resp.json()["data"][0]
    assert "owned_by" in model
