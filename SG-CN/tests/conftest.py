"""
tests/conftest.py — Shared pytest fixtures for the gateway test suite.

Uses httpx.AsyncClient with FastAPI's ASGITransport so tests run
fully in-process without needing a real server or upstream.
"""

import pytest
import pytest_asyncio
import httpx
from unittest.mock import AsyncMock, MagicMock

from main import app


VALID_TOKEN = "test-gateway-key"
UPSTREAM_URL = "https://fake-upstream.example.com"


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    """Override settings so tests don't need a .env file."""
    monkeypatch.setenv("GATEWAY_API_KEY", VALID_TOKEN)
    monkeypatch.setenv("SOPHNET_API_URL", UPSTREAM_URL)
    monkeypatch.setenv("SOPHNET_API_KEY", "upstream-key")
    monkeypatch.setenv("SOPHNET_AUTH_MODE", "bearer")
    monkeypatch.setenv("DEFAULT_MODEL", "qwenvl")
    monkeypatch.setenv("REQUEST_TIMEOUT", "30")

    # Re-import settings after env patch so Pydantic picks up new values
    import config
    from importlib import reload
    reload(config)


@pytest_asyncio.fixture
async def client():
    """
    Async test client bound to the FastAPI app via ASGITransport.
    Manages the app lifespan so httpx client is properly initialized.
    """
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as c:
        yield c


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {VALID_TOKEN}"}


@pytest.fixture
def bad_auth_headers():
    return {"Authorization": "Bearer wrong-key"}
