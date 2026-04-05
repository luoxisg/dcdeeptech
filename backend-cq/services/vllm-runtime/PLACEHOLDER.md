# backend-cq/services/vllm-runtime — PLACEHOLDER

**Status:** Not yet implemented. This directory is reserved for the Chongqing vLLM runtime service.

**Owner:** Chongqing infrastructure team

## What belongs here

- vLLM server startup configuration and scripts
- Model registry (`config/models.yaml`) — which models to load, VRAM budgets, quantization settings
- Model loading and warm-up logic
- Any vLLM-specific configuration (LoRA adapters, sampling parameters, token limits)

## What does NOT belong here

- `dispatcher.py` — this is the SG-side HTTP client that *calls* CQ. It lives in `platform-sg/services/gateway/routing/`.
- `openai_compatible.py` — called before dispatch, runs in Singapore. Lives in `platform-sg/services/gateway/adapters/`.
- Any auth, PII detection, policy, or audit logic — those belong in `platform-sg/`.

## How SG communicates with this service

The SG gateway's `dispatcher.py` makes HTTP POST requests to the `inference-api` service (see `../inference-api/`). The vLLM runtime is a backend for the inference-api — it is not exposed directly to the SG gateway.

```
SG gateway (dispatcher.py)
  → CQ inference-api (HTTP, port 8090)
    → vLLM runtime (local, port 8000)
```
