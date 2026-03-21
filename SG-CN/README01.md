# DCDeepTech AI Gateway

**api.dcdeeptech.com** — OpenAI-compatible Singapore gateway for cross-border AI inference.

---

## Overview

This gateway sits between global API clients and a China-side GPU inference cluster running vLLM + Qwen-VL. It exposes an OpenAI-compatible REST API so existing clients (LangChain, OpenAI SDK, curl) can point at `api.dcdeeptech.com` without modification.

```
Global Clients
    │  Authorization: Bearer <GATEWAY_API_KEY>
    ▼
api.dcdeeptech.com  (Singapore · FastAPI)
    │  Authorization: Bearer <SOPHNET_API_KEY>
    ▼
China GPU Cluster  (vLLM + Qwen-VL)
```

---

## Architecture

| Component | Detail |
|---|---|
| Runtime | Python 3.12 + FastAPI + Uvicorn |
| HTTP client | async httpx (shared client, connection pool) |
| Auth | Bearer token (client → gateway) |
| Upstream auth | Bearer token (gateway → China backend) |
| Streaming | SSE proxy via httpx streaming |
| Multimodal | image_url content parts forwarded to Qwen-VL |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GATEWAY_API_KEY` | ✅ | Token clients must supply in `Authorization: Bearer` |
| `GATEWAY_HOST` | | Bind address (default: `0.0.0.0`) |
| `GATEWAY_PORT` | | Bind port (default: `8000`) |
| `SOPHNET_API_URL` | ✅ | Base URL of the China-side inference backend |
| `SOPHNET_API_KEY` | ✅ | API key for the upstream backend |
| `SOPHNET_AUTH_MODE` | | `bearer` (default) or `none` |
| `DEFAULT_MODEL` | | Fallback model name (default: `qwenvl`) |
| `REQUEST_TIMEOUT` | | Upstream timeout in seconds (default: `60`) |

---

## Local Run

```bash
# 1. Clone and enter project
cd dcdeeptech-gateway

# 2. Create virtualenv
python -m venv .venv && source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with real values

# 5. Run
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Docker Run

```bash
# Build
docker build -t dcdeeptech-gateway .

# Run (pass env file)
docker run --env-file .env -p 8000:8000 dcdeeptech-gateway

# Or pass env vars directly
docker run \
  -e GATEWAY_API_KEY=my-secret \
  -e SOPHNET_API_URL=https://cn-backend.example.com \
  -e SOPHNET_API_KEY=upstream-key \
  -p 8000:8000 \
  dcdeeptech-gateway
```

---

## API Usage

### Health check (no auth required)

```bash
curl https://api.dcdeeptech.com/health
```

```json
{
  "status": "ok",
  "service": "DCDeepTech AI Gateway",
  "region": "Singapore",
  "timestamp": 1710000000,
  "upstream": { "reachable": true, "status": 200 }
}
```

---

### List models

```bash
curl https://api.dcdeeptech.com/v1/models \
  -H "Authorization: Bearer $GATEWAY_API_KEY"
```

```json
{
  "object": "list",
  "data": [
    { "id": "qwenvl", "object": "model", "created": 1710000000, "owned_by": "dcdeeptech" }
  ]
}
```

---

### Chat completion (text)

```bash
curl https://api.dcdeeptech.com/v1/chat/completions \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwenvl",
    "messages": [
      { "role": "user", "content": "What is the capital of Singapore?" }
    ]
  }'
```

---

### Chat completion (streaming)

```bash
curl https://api.dcdeeptech.com/v1/chat/completions \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwenvl",
    "stream": true,
    "messages": [
      { "role": "user", "content": "Tell me a joke." }
    ]
  }'
```

---

### Multimodal — Qwen-VL image input

```bash
curl https://api.dcdeeptech.com/v1/chat/completions \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwenvl",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": { "url": "https://example.com/chart.png" }
          },
          {
            "type": "text",
            "text": "Describe what you see in this chart."
          }
        ]
      }
    ]
  }'
```

---

### Using the OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.dcdeeptech.com/v1",
    api_key="your-gateway-api-key",
)

response = client.chat.completions.create(
    model="qwenvl",
    messages=[{"role": "user", "content": "Hello from Singapore!"}],
)
print(response.choices[0].message.content)
```

---

## Project Structure

```
main.py          # FastAPI app, lifespan, middleware, route mounting
config.py        # Pydantic Settings (env vars)
auth.py          # Bearer token dependency
models.py        # Pydantic request/response models
adapters.py      # Request/response normalization layer
routes/
  health.py      # GET /health
  models.py      # GET /v1/models
  chat.py        # POST /v1/chat/completions
utils/
  logging.py     # Logging configuration
  request_id.py  # X-Request-ID middleware
requirements.txt
Dockerfile
.env.example
```

---

## Notes

- The gateway is **stateless** — safe to run multiple replicas behind a load balancer.
- Secrets (`GATEWAY_API_KEY`, `SOPHNET_API_KEY`) are never logged.
- `X-Request-ID` is generated per request and echoed in responses for tracing.
- Upstream SSE stream is proxied with `X-Accel-Buffering: no` to prevent nginx from buffering chunks.
