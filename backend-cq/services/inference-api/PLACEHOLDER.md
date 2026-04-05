# backend-cq/services/inference-api — PLACEHOLDER

**Status:** Partially scaffolded. This is the CQ-side HTTP endpoint that the SG gateway's `dispatcher.py` calls.

**Owner:** Chongqing infrastructure team

## What belongs here

- `POST /v1/chat/completions` — OpenAI-compatible endpoint that proxies to the local vLLM runtime
- Request validation (model availability, sequence length limits)
- CQ-side rate limiting and queue management
- Response streaming (SSE) support

## What does NOT belong here

- Auth, PII detection, policy evaluation — those execute in SG before the request ever reaches CQ
- Audit logging of prompt content — SG handles audit; CQ may log only infrastructure metrics
- Admin UI — that's `platform-sg/apps/admin-console/`

## Call chain

```
SG gateway dispatcher.py
  → POST http://<cq-inference-api>:8090/v1/chat/completions
    → local vLLM runtime (localhost:8000)
```

The SG gateway injects `Authorization: Bearer <UPSTREAM_API_KEY>` (an internal service key, never exposed to the end customer). This service must validate that header.
