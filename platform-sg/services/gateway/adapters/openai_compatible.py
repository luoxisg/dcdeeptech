"""
OpenAI-compatible adapter for vLLM and LiteLLM backends.

Provides a thin async wrapper over the /v1/chat/completions endpoint.
Used by the Dispatcher; can be swapped for provider-specific adapters
(TGI, Ollama, Bedrock) without changing the Dispatcher interface.

The upstream API key is read from environment here — callers never see it.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "120"))


class OpenAICompatibleAdapter:
    """
    Adapter for any OpenAI-compatible inference backend.
    Handles non-streaming chat completions for the prototype.

    Future: add stream=True support via SSE forwarding.
    """

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self._api_key = api_key or os.getenv("UPSTREAM_API_KEY", "")

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    async def chat_completions(
        self,
        payload: dict,
        extra_headers: Optional[dict[str, str]] = None,
    ) -> dict:
        """
        POST /v1/chat/completions to the backend.
        Raises httpx.HTTPStatusError on 4xx/5xx responses.
        """
        headers = {**self._headers(), **(extra_headers or {})}

        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def list_models(self) -> dict:
        """GET /v1/models — useful for health checks and model discovery."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/v1/models",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
