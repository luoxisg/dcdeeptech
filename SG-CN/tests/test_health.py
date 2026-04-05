"""
tests/test_health.py — Tests for GET /health
"""

import pytest
import respx
import httpx


@pytest.mark.anyio
async def test_health_ok_no_auth(client):
    """Health endpoint must be reachable without authentication."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/health").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "DCDeepTech AI Gateway"
    assert body["region"] == "Singapore"
    assert "timestamp" in body


@pytest.mark.anyio
async def test_health_upstream_unreachable(client):
    """Health endpoint returns 200 even when upstream is down."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/health").mock(
            side_effect=httpx.ConnectError("unreachable")
        )
        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["upstream"]["reachable"] is False


@pytest.mark.anyio
async def test_health_returns_request_id(client):
    """Response must include x-request-id header."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/health").mock(
            return_value=httpx.Response(200)
        )
        resp = await client.get("/health")

    assert "x-request-id" in resp.headers


@pytest.mark.anyio
async def test_health_accepts_existing_request_id(client):
    """If client sends x-request-id, it must be echoed back."""
    with respx.mock:
        respx.get("https://fake-upstream.example.com/health").mock(
            return_value=httpx.Response(200)
        )
        resp = await client.get("/health", headers={"x-request-id": "my-trace-123"})

    assert resp.headers["x-request-id"] == "my-trace-123"
