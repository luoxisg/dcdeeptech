"""
tests/test_auth.py — Authentication behaviour across protected endpoints.
"""

import pytest


@pytest.mark.anyio
async def test_missing_auth_returns_401(client):
    resp = await client.get("/v1/models")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_wrong_token_returns_401(client, bad_auth_headers):
    resp = await client.get("/v1/models", headers=bad_auth_headers)
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_malformed_auth_scheme_returns_401(client):
    """Basic scheme is not accepted."""
    resp = await client.get("/v1/models", headers={"Authorization": "Basic abc123"})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_no_auth_on_chat_returns_401(client):
    resp = await client.post(
        "/v1/chat/completions",
        json={"model": "qwenvl", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_health_requires_no_auth(client):
    """Health must be reachable without any token."""
    import respx
    import httpx as _httpx

    with respx.mock:
        respx.get("https://fake-upstream.example.com/health").mock(
            return_value=_httpx.Response(200)
        )
        resp = await client.get("/health")
    assert resp.status_code == 200
