"""
Request dispatcher — forwards processed inference requests to the correct backend.

Backends:
  sg  → Singapore LiteLLM gateway  (env: SG_LITELLM_URL)
  cq  → Chongqing vLLM endpoint    (env: CQ_VLLM_URL)

The upstream API key (UPSTREAM_API_KEY) is injected here and is NEVER
visible to the original caller — they only ever present their DCDeepTech key.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

_BACKENDS: dict[str, str] = {
    "sg": os.getenv("SG_LITELLM_URL", "http://localhost:4000"),
    "cq": os.getenv("CQ_VLLM_URL", "http://localhost:8000"),
}

_UPSTREAM_KEY = os.getenv("UPSTREAM_API_KEY", "")
_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "120"))


class Dispatcher:
    async def dispatch(
        self,
        messages: list,
        model: str,
        body: dict,
        destination: str,
        route_name: str,
    ) -> dict:
        """
        Forward a chat-completions request to the appropriate backend.

        Strips caller-supplied headers, injects internal upstream key,
        attaches routing metadata headers for traceability.
        """
        base_url = _BACKENDS.get(destination)
        if not base_url:
            raise ValueError(f"Unknown destination region: '{destination}'")

        payload = {**body, "messages": messages, "model": model}

        headers = {
            "Content-Type": "application/json",
            "X-Route-Name": route_name,
            "X-Destination-Region": destination,
        }
        if _UPSTREAM_KEY:
            headers["Authorization"] = f"Bearer {_UPSTREAM_KEY}"

        logger.info(
            "dispatch.sending destination=%s route=%s model=%s",
            destination, route_name, model,
        )

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{base_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            )

        if response.status_code >= 400:
            logger.error(
                "dispatch.upstream_error destination=%s status=%d",
                destination, response.status_code,
            )
            response.raise_for_status()

        return response.json()
