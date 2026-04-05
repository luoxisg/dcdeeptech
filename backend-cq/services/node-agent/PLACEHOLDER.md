# backend-cq/services/node-agent — PLACEHOLDER

**Status:** Not yet implemented. Reserved for the Chongqing GPU node health agent.

**Owner:** Chongqing infrastructure team

## What belongs here

- GPU node health reporting (NVML/pynvml metrics: utilization, memory, temperature, power)
- Node registration and heartbeat to a central registry
- Prometheus metrics exporter (`/metrics` endpoint)
- Alert thresholds for OOM, high temperature, process crashes

## What does NOT belong here

- Model serving logic — belongs in `vllm-runtime/`
- Inference API endpoint — belongs in `inference-api/`
- Any SG-side logic — stays in `platform-sg/`

## Data flow

```
node-agent (each GPU node)
  → exposes /metrics (Prometheus scrape)
  → posts heartbeat to internal registry
  → admin-console (platform-sg) reads node health via registry API
```
