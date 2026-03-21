
````md
# SG-CN AI Gateway POC

A Singapore-based OpenAI-compatible gateway for cross-border AI inference.

一个部署在新加坡、面向跨境 AI 推理的 OpenAI 兼容网关。

---

## Overview

This project implements the core gateway logic for `api.dcdeeptech.com`.

It is designed as a Singapore-side API layer that sits between global clients and China-side inference infrastructure, exposing an OpenAI-compatible interface while handling authentication, request normalization, response adaptation, streaming, and operational observability.

该项目实现了 `api.dcdeeptech.com` 的核心网关逻辑。

它被设计为部署在新加坡侧的 API 层，位于全球客户端与中国侧推理基础设施之间，对外提供 OpenAI 兼容接口，同时处理鉴权、请求规范化、响应适配、流式传输和运行可观测性。

---

## Architecture

### High-Level Flow

```text
Global Clients
      ↓
Singapore API Gateway (api.dcdeeptech.com)
      ↓
Cross-border Channel
      ↓
China GPU / vLLM / Qwen-VL Backend
      ↓
OpenAI-Compatible Response
````

### Gateway Responsibilities

The gateway is responsible for:

* exposing OpenAI-compatible endpoints
* authenticating client requests with Bearer token
* forwarding requests to upstream inference services
* normalizing upstream payloads into OpenAI-style schemas
* supporting multimodal input for Qwen-VL
* supporting both standard and streaming chat completions
* providing health checks, model listing, request logging, and request tracing

网关承担以下职责：

* 对外暴露 OpenAI 兼容接口
* 使用 Bearer Token 对客户端请求进行鉴权
* 将请求转发到上游推理服务
* 将上游返回结果规范化为 OpenAI 风格格式
* 支持 Qwen-VL 多模态输入
* 支持普通与流式聊天补全
* 提供健康检查、模型列表、请求日志与请求追踪能力

---

## Project Structure

This gateway is organized as a compact, production-oriented FastAPI service for `api.dcdeeptech.com`, with clear separation between configuration, authentication, schema modeling, protocol adaptation, routing, and observability.

本网关采用紧凑、面向生产环境的 FastAPI 服务结构，服务于 `api.dcdeeptech.com`，并在配置、鉴权、数据模型、协议适配、路由和可观测性之间进行了清晰分层。

### File Breakdown

**Total: 840 lines**

| File                  | Purpose                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main.py`             | App factory and lifespan management for the shared `httpx.AsyncClient`, and mounts all routers.                                                                    |
| `config.py`           | Loads all environment variables from `.env` via `pydantic-settings`, with type coercion and validation.                                                            |
| `auth.py`             | `HTTPBearer` authentication dependency reused by all `/v1/*` routes via `Depends(verify_api_key)`.                                                                 |
| `models.py`           | Full Pydantic schema definitions, including `ContentPart` union (`text` + `image_url`), `ChatMessage`, `ChatCompletionRequest`, and response models.               |
| `adapters.py`         | Protocol normalization layer: `adapt_request_to_upstream`, `adapt_response_to_openai`, and `adapt_model_list_to_openai`, with graceful handling of missing fields. |
| `routes/health.py`    | No-auth `/health` endpoint with best-effort upstream ping; upstream failure never causes the health check itself to fail.                                          |
| `routes/models.py`    | Proxies upstream model listing, with fallback to `DEFAULT_MODEL` on timeout or upstream error.                                                                     |
| `routes/chat.py`      | Full streaming and non-streaming chat completion support, using `httpx.stream()` for SSE proxying and `X-Accel-Buffering: no` for Nginx compatibility.             |
| `utils/logging.py`    | Configures stdout logging and reduces `httpx` / `uvicorn` noise for cleaner operational logs.                                                                      |
| `utils/request_id.py` | Starlette middleware that injects an `x-request-id` header into every request and response.                                                                        |

### 文件明细

**总计：840 行**

| 文件                    | 作用                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `main.py`             | 应用工厂与生命周期管理模块，负责共享 `httpx.AsyncClient` 的初始化与释放，并挂载所有路由。                                                          |
| `config.py`           | 通过 `pydantic-settings` 从 `.env` 加载全部环境变量，并进行类型转换与校验。                                                             |
| `auth.py`             | `HTTPBearer` 鉴权依赖模块，所有 `/v1/*` 路由通过 `Depends(verify_api_key)` 统一复用。                                              |
| `models.py`           | 完整的 Pydantic 数据模型定义，包括 `ContentPart` 联合类型（`text` + `image_url`）、`ChatMessage`、`ChatCompletionRequest` 以及响应模型。    |
| `adapters.py`         | 协议适配层，包括 `adapt_request_to_upstream`、`adapt_response_to_openai`、`adapt_model_list_to_openai` 三个规范化函数，并可优雅处理字段缺失。 |
| `routes/health.py`    | 无需鉴权的 `/health` 健康检查接口，尽力探测上游状态，但上游失败不会导致健康检查本身失败。                                                               |
| `routes/models.py`    | 代理上游模型列表；在超时或上游异常时自动回退到 `DEFAULT_MODEL`。                                                                         |
| `routes/chat.py`      | 完整支持流式与非流式聊天补全；通过 `httpx.stream()` 实现 SSE 代理，并设置 `X-Accel-Buffering: no` 以兼容 Nginx。                              |
| `utils/logging.py`    | 配置标准输出日志，并压低 `httpx` / `uvicorn` 的噪音日志，便于生产环境观察。                                                                 |
| `utils/request_id.py` | Starlette 中间件，为每个请求和响应注入 `x-request-id` 请求追踪头。                                                                   |

---

## Environment Variables

The gateway is configured via environment variables loaded from `.env`.

网关通过 `.env` 文件中的环境变量进行配置。

### Required Variables

| Variable            | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `GATEWAY_API_KEY`   | Bearer token required for client access to `/v1/*` endpoints.     |
| `GATEWAY_HOST`      | Host to bind the FastAPI server.                                  |
| `GATEWAY_PORT`      | Port to bind the FastAPI server.                                  |
| `SOPHNET_API_URL`   | Base URL of the upstream China-side inference service.            |
| `SOPHNET_API_KEY`   | Upstream service API key.                                         |
| `SOPHNET_AUTH_MODE` | Upstream auth mode, typically `bearer`.                           |
| `DEFAULT_MODEL`     | Fallback model name used when upstream model list is unavailable. |
| `REQUEST_TIMEOUT`   | Timeout in seconds for upstream requests.                         |

### 示例 `.env`

```env
GATEWAY_API_KEY=your-gateway-api-key
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=8000

SOPHNET_API_URL=https://your-china-endpoint
SOPHNET_API_KEY=your-upstream-key
SOPHNET_AUTH_MODE=bearer

DEFAULT_MODEL=qwenvl
REQUEST_TIMEOUT=60
```

---

## Run Locally

### 1. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

On Windows:

```bash
.venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Prepare environment variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit the values according to your deployment and upstream configuration.

### 4. Start the gateway

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Health check

```bash
curl http://127.0.0.1:8000/health
```

---

## API Endpoints

### `GET /health`

Returns service health information.

返回服务健康状态信息。

### `GET /v1/models`

Returns OpenAI-style model listing.

返回 OpenAI 风格的模型列表。

Requires Bearer authentication.

需要 Bearer 鉴权。

### `POST /v1/chat/completions`

Accepts OpenAI-compatible chat completion payloads.

接受 OpenAI 兼容格式的聊天补全请求。

Supports:

* text-only messages
* multimodal messages with `image_url`
* `stream=false`
* `stream=true`

支持：

* 纯文本消息
* 带 `image_url` 的多模态消息
* `stream=false`
* `stream=true`

---

## Example Usage

### Health Check

```bash
curl http://127.0.0.1:8000/health
```

### List Models

```bash
curl http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer your-gateway-api-key"
```

### Chat Completion

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer your-gateway-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwenvl",
    "messages": [
      {
        "role": "user",
        "content": "Hello, introduce yourself."
      }
    ],
    "stream": false
  }'
```

### Multimodal Qwen-VL Example

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer your-gateway-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwenvl",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "https://example.com/image.jpg"
            }
          },
          {
            "type": "text",
            "text": "Describe this image."
          }
        ]
      }
    ],
    "stream": false
  }'
```

---

## Production Notes

The current structure already includes several design choices that are particularly useful in production environments.

当前结构已经包含若干对生产环境尤其有价值的设计选择。

### 1. Shared `httpx` Client Across All Requests

A single `httpx.AsyncClient` is shared across all requests via `app.state`, which avoids the overhead of creating a new TCP connection per request. This is especially important for cross-border traffic, where reducing repeated TCP handshakes materially improves latency and efficiency.

通过 `app.state` 在全局共享单个 `httpx.AsyncClient`，避免了每次请求都重新建立 TCP 连接的开销。对于跨境链路而言，这一点尤其重要，因为减少重复握手能够显著改善延迟和效率。

### 2. Streaming Error Handling Returns Valid SSE Events

When upstream streaming fails, the gateway emits a valid SSE `data:` error event instead of crashing mid-stream. This gives downstream clients a clean and protocol-compatible failure signal, which is much easier to handle in real integrations.

当上游流式传输发生异常时，网关不会在中途崩溃，而是返回一个有效的 SSE `data:` 错误事件。这样下游客户端可以收到一个干净、协议兼容的失败信号，便于在真实集成环境中处理。

### 3. Unknown OpenAI Parameters Pass Through Automatically

`ChatCompletionRequest` uses:

```python
model_config = {"extra": "allow"}
```

This allows unknown OpenAI-compatible parameters such as `logit_bias`, `seed`, and `tools` to pass through to the upstream service automatically, without needing to be explicitly modeled in advance. This makes the gateway more future-proof and more tolerant of evolving client SDKs.

`ChatCompletionRequest` 使用了：

```python
model_config = {"extra": "allow"}
```

这意味着未知的 OpenAI 兼容参数，例如 `logit_bias`、`seed`、`tools`，都可以自动透传到上游，而无需预先在模型中逐一显式定义。这让网关对新参数和不断演进的客户端 SDK 更具兼容性和前向适配能力。

---

## Summary

This codebase is intentionally small, but it already captures the key characteristics of a production-friendly Singapore gateway for cross-border inference:

* shared async upstream client
* reusable auth layer
* OpenAI-compatible request and response models
* graceful adaptation across protocol boundaries
* streaming-safe SSE behavior
* operational logging and request tracing

这套代码结构虽然精简，但已经具备一个面向生产环境的新加坡跨境推理网关的关键特征：

* 共享异步上游客户端
* 可复用鉴权层
* OpenAI 兼容的请求与响应模型
* 协议边界上的优雅适配
* 对流式 SSE 传输友好的异常处理
* 生产可用的日志与请求追踪能力

```

如果你要，我也可以把这段直接整理成一个新的 `readme02.md` 文件给你下载。
```
