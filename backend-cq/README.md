# backend-cq — Chongqing Execution Plane

This folder owns everything that runs in Chongqing: GPU node management, model serving, and the inference API that the Singapore gateway dispatches to.

**Current status:** Scaffold only. No production code yet.

## What lives here

| Path | Description | Status |
|---|---|---|
| `services/vllm-runtime/` | vLLM server config, model registry, startup scripts | PLACEHOLDER |
| `services/node-agent/` | GPU node health reporting, NVML metrics, Prometheus exporter | PLACEHOLDER |
| `services/inference-api/` | CQ-side HTTP endpoint called by SG gateway dispatcher | Scaffolded |
| `deploy/` | docker-compose for running the full CQ plane locally | PLACEHOLDER |

## Boundary rules

- **Does NOT import from `platform-sg/`** — CQ code has no dependency on SG code. SG calls CQ, not the other way around.
- **Does NOT handle auth, PII, or policy** — those execute in Singapore before requests reach CQ.
- **`dispatcher.py` is NOT here** — it's the SG-side client. Lives in `platform-sg/services/gateway/routing/`.
- **`openai_compatible.py` is NOT here** — it runs in Singapore, called before dispatch. Lives in `platform-sg/services/gateway/adapters/`.

## Call chain

```
internet
  → SG gateway (platform-sg/services/gateway)
      auth → PII detect → redact → policy → dispatch
        → CQ inference-api (backend-cq/services/inference-api)
            → vLLM runtime (backend-cq/services/vllm-runtime)
```

## When to add code here

Add code here when:
- You are writing GPU/NVML operations
- You are configuring or starting vLLM
- You are writing the CQ-side HTTP endpoint that `dispatcher.py` calls
- You are managing CQ model loading, serving, or scheduling

Do NOT add code here if it runs in Singapore or if it belongs to the SG control plane.
