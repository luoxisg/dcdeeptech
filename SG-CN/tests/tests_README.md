# 🧪 SG-CN Gateway — Test Suite

**Test suite for `api.dcdeeptech.com` gateway**
**DCDeepTech AI Gateway 测试套件**

> Repo: `github.com/luoxisg/dcdeeptech` · `main/SG-CN/tests/`

---

## 📑 Table of Contents / 目录

- [Overview / 概述](#overview--概述)
- [File Structure / 文件结构](#file-structure--文件结构)
- [How It Works / 运行原理](#how-it-works--运行原理)
- [Quick Start / 快速开始](#quick-start--快速开始)
- [Test Files / 测试文件说明](#test-files--测试文件说明)
- [Rate Limit Testing / 速率限制测试](#rate-limit-testing--速率限制测试)
- [Docker Compose / 容器化测试](#docker-compose--容器化测试)
- [Configuration / 配置说明](#configuration--配置说明)
- [Expected Output / 期望输出](#expected-output--期望输出)
- [CI Integration / 持续集成](#ci-integration--持续集成)

---

## Overview / 概述

This test suite validates the full SG-CN gateway stack — authentication, chat completions (text + multimodal + streaming), model listing, health checks, adapter normalisation, and rate limiting — **entirely in-process** without a real upstream connection.

本测试套件验证 SG-CN 网关的完整功能：鉴权、对话补全（文本 + 多模态 + 流式）、模型列表、健康检查、适配器归一化以及速率限制。测试**完全在进程内运行**，无需真实上游连接。

**Key design choices / 核心设计：**

- `httpx.ASGITransport` — binds the test client directly to the FastAPI app; no real TCP port needed / 直接绑定 FastAPI 应用，无需真实 TCP 端口
- `respx` — intercepts all outbound `httpx` calls and returns mock upstream responses / 拦截所有出站 httpx 请求并返回 mock 上游响应
- `pytest-asyncio` / `anyio` — all tests are async-native / 全异步原生测试
- Zero secrets required — all credentials are injected via `monkeypatch` in `conftest.py` / 无需真实密钥，所有凭证通过 `conftest.py` 注入

---

## File Structure / 文件结构

```
tests/
├── conftest.py          # Shared fixtures: async client, auth headers, env patches
│                        # 共享 fixture：异步客户端、鉴权头、环境变量注入
├── pytest.ini           # pytest config: asyncio_mode=auto, testpaths
│                        # pytest 配置：自动 asyncio 模式
├── requirements.txt     # Test-only dependencies (pytest, respx, anyio …)
│                        # 测试专用依赖
├── main.py              # Thin test-runner entry point (optional local use)
│                        # 可选的本地测试运行入口
├── rate_limit.py        # Rate-limit middleware test helpers / utilities
│                        # 速率限制中间件测试工具
├── docker-compose.yml   # Containerised test environment
│                        # 容器化测试环境
├── test_auth.py         # Authentication guard tests
│                        # 鉴权验证测试
├── test_health.py       # GET /health endpoint tests
│                        # 健康检查接口测试
├── test_models.py       # GET /v1/models endpoint tests
│                        # 模型列表接口测试
├── test_chat.py         # POST /v1/chat/completions tests (text, multimodal, stream)
│                        # 对话补全测试（文本、多模态、流式）
├── test_adapters.py     # Unit tests for adapters.py normalisation layer
│                        # adapters.py 归一化层单元测试
└── readme.md            # This file / 本文件
```

---

## How It Works / 运行原理

```
pytest
  │
  ├── conftest.py patches env vars (monkeypatch)
  │   设置测试用环境变量（无需 .env 文件）
  │
  ├── AsyncClient(ASGITransport(app=app))
  │   直接绑定 FastAPI 应用，不占用真实端口
  │
  └── respx.mock intercepts httpx outbound calls
      拦截所有出站 httpx 请求，返回 mock 上游响应
      │
      ├── Upstream success   → mock 200 + JSON body
      ├── Upstream timeout   → mock TimeoutException
      ├── Upstream 401/502   → mock error status
      └── Streaming SSE      → mock chunked bytes
```

No real upstream connection is made during tests.
测试期间不发起任何真实上游请求。

---

## Quick Start / 快速开始

### 1. Install dependencies / 安装依赖

```bash
# From SG-CN/ root  在 SG-CN/ 根目录执行
source .venv/bin/activate

pip install -r tests/requirements.txt
# or if test deps are already in the root requirements.txt:
# pip install -r requirements.txt
```

### 2. Run all tests / 运行所有测试

```bash
# From SG-CN/ root  在 SG-CN/ 根目录执行
pytest tests/ -v
```

### 3. Run a specific file / 运行单个测试文件

```bash
pytest tests/test_auth.py -v
pytest tests/test_chat.py -v
pytest tests/test_adapters.py -v
```

### 4. Run a specific test / 运行单个测试用例

```bash
pytest tests/test_chat.py::test_chat_multimodal_image_url -v
```

### 5. Run with coverage / 运行并生成覆盖率报告

```bash
pip install pytest-cov
pytest tests/ --cov=. --cov-report=term-missing
```

---

## Test Files / 测试文件说明

### `conftest.py` — Shared Fixtures / 共享 Fixture

Provides fixtures used across all test files.
提供所有测试文件共享的 fixture。

| Fixture | Scope | Description / 说明 |
|---|---|---|
| `patch_settings` | `autouse` | Injects test env vars via `monkeypatch`; reloads `config` module. / 注入测试环境变量，重载 config 模块 |
| `client` | function | `httpx.AsyncClient` bound to the FastAPI app via `ASGITransport`. / 绑定 FastAPI app 的异步测试客户端 |
| `auth_headers` | function | `{"Authorization": "Bearer test-gateway-key"}` |
| `bad_auth_headers` | function | `{"Authorization": "Bearer wrong-key"}` |

**Test constants injected by `conftest.py`:**

```python
VALID_TOKEN   = "test-gateway-key"
UPSTREAM_URL  = "https://fake-upstream.example.com"
DEFAULT_MODEL = "qwenvl"
```

---

### `test_auth.py` — Authentication Guard / 鉴权验证

Tests that the `auth.py` Bearer token dependency correctly protects all `/v1/*` routes.
验证 `auth.py` 的 Bearer Token 依赖正确保护所有 `/v1/*` 路由。

| Test | What it verifies / 验证内容 |
|---|---|
| `test_missing_auth_returns_401` | No `Authorization` header → 401 |
| `test_wrong_token_returns_401` | Wrong Bearer token → 401 |
| `test_malformed_auth_scheme_returns_401` | `Basic` scheme (not Bearer) → 401 |
| `test_no_auth_on_chat_returns_401` | `POST /v1/chat/completions` without token → 401 |
| `test_health_requires_no_auth` | `GET /health` without token → 200 |

---

### `test_health.py` — Health Endpoint / 健康检查

Tests the `GET /health` endpoint behaviour under various upstream conditions.
验证 `GET /health` 在各种上游状态下的行为。

| Test | What it verifies / 验证内容 |
|---|---|
| `test_health_ok_no_auth` | Returns 200 with `status="ok"` when upstream is reachable |
| `test_health_upstream_unreachable` | Returns 200 even when upstream raises `ConnectError` — health endpoint never fails |
| `test_health_returns_request_id` | Response includes `x-request-id` header |
| `test_health_accepts_existing_request_id` | Client-supplied `x-request-id` is echoed back unchanged |

---

### `test_models.py` — Model Listing / 模型列表

Tests the `GET /v1/models` endpoint proxying and fallback logic.
验证 `/v1/models` 代理与降级逻辑。

| Test | What it verifies / 验证内容 |
|---|---|
| `test_models_returns_list` | Upstream 200 → normalised `{object:"list", data:[...]}` returned |
| `test_models_fallback_on_upstream_timeout` | Upstream `TimeoutException` → fallback to `DEFAULT_MODEL` |
| `test_models_fallback_on_upstream_error` | Upstream 503 → fallback to `DEFAULT_MODEL` |
| `test_models_normalizes_owned_by` | `owned_by` field preserved from upstream when present |

---

### `test_chat.py` — Chat Completions / 对话补全

The most comprehensive test file. Covers the full `POST /v1/chat/completions` path.
最全面的测试文件，覆盖 `/v1/chat/completions` 的完整路径。

#### Non-streaming / 非流式

| Test | What it verifies / 验证内容 |
|---|---|
| `test_chat_text_message` | Basic text message → normalised OpenAI response |
| `test_chat_preserves_model_name` | Response `model` field matches request |
| `test_chat_generates_fallback_id_when_missing` | Missing upstream `id` → gateway generates `chatcmpl-xxx` |
| `test_chat_forwards_temperature` | `temperature` and `max_tokens` forwarded to upstream payload |
| `test_chat_upstream_timeout_returns_504` | Upstream timeout → HTTP 504 |
| `test_chat_upstream_502_propagated` | Upstream 502 → propagated to client |
| `test_chat_upstream_401_returns_502` | Upstream 401 (auth failure) → client receives 502, not 401 |

#### Multimodal / 多模态

| Test | What it verifies / 验证内容 |
|---|---|
| `test_chat_multimodal_image_url` | `image_url` content part serialised correctly and forwarded as list |
| `test_chat_system_message` | System role messages forwarded with correct role and content |

#### Streaming / 流式

| Test | What it verifies / 验证内容 |
|---|---|
| `test_chat_streaming_response_content_type` | `Content-Type: text/event-stream` returned |
| `test_chat_streaming_timeout_yields_error_event` | Upstream timeout during stream → SSE error event, not crash |

#### Validation / 参数校验

| Test | What it verifies / 验证内容 |
|---|---|
| `test_chat_missing_messages_returns_422` | Missing `messages` → Pydantic 422 |
| `test_chat_missing_model_returns_422` | Missing `model` → Pydantic 422 |

---

### `test_adapters.py` — Normalisation Layer / 适配器归一化层

Pure unit tests for `adapters.py` — no HTTP involved, runs fastest.
`adapters.py` 的纯单元测试，无 HTTP 调用，运行最快。

#### `adapt_request_to_upstream`

| Test | What it verifies / 验证内容 |
|---|---|
| `test_adapt_request_plain_text` | Plain string content serialised correctly |
| `test_adapt_request_multimodal` | `image_url` + `text` parts serialised as list of dicts |
| `test_adapt_request_excludes_none_fields` | `None` fields omitted from upstream payload |
| `test_adapt_request_includes_explicit_fields` | `temperature`, `max_tokens`, `stream` included when set |
| `test_adapt_request_system_message` | System + user messages both forwarded with correct roles |

#### `adapt_response_to_openai`

| Test | What it verifies / 验证内容 |
|---|---|
| `test_adapt_response_full` | Full upstream response normalised correctly |
| `test_adapt_response_generates_fallback_id` | Missing `id` → `chatcmpl-{uuid}` generated |
| `test_adapt_response_generates_created_timestamp` | Missing `created` → current timestamp inserted |
| `test_adapt_response_handles_missing_usage` | Missing `usage` → `None` (not crash) |
| `test_adapt_response_multiple_choices` | Multiple `choices` all normalised |

#### `adapt_model_list_to_openai`

| Test | What it verifies / 验证内容 |
|---|---|
| `test_adapt_model_list_standard_data_key` | Standard `{"data": [...]}` upstream format |
| `test_adapt_model_list_models_key_fallback` | Alternative `{"models": [...]}` upstream format |
| `test_adapt_model_list_string_ids` | Plain string model IDs in list |
| `test_adapt_model_list_empty` | Empty list returns `{object:"list", data:[]}` |

---

## Rate Limit Testing / 速率限制测试

`rate_limit.py` contains test utilities and helpers for the `RateLimitMiddleware` defined in the main codebase.
`rate_limit.py` 包含针对主代码库中 `RateLimitMiddleware` 的测试工具与辅助函数。

**What is tested / 测试内容：**

- Requests within the limit window pass through / 窗口内请求正常放行
- Requests exceeding the limit return `429 Too Many Requests` / 超出限制返回 `429`
- `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers are set correctly / 速率限制响应头正确设置
- `/health` and `/` paths are exempt from rate limiting / `/health` 和 `/` 路径豁免限制
- Bucket resets after the window expires / 时间窗口到期后桶自动重置
- Per-key isolation: different tokens have independent buckets / 不同 Token 独立计数桶

**Key env vars for rate limit tests / 速率限制测试相关环境变量：**

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=60    # requests allowed per window
RATE_LIMIT_WINDOW=60      # window size in seconds
```

To run rate limit tests in isolation: / 单独运行速率限制测试：

```bash
pytest tests/rate_limit.py -v
```

---

## Docker Compose / 容器化测试

`docker-compose.yml` in the `tests/` directory spins up an isolated test environment without requiring a local Python setup.
`tests/docker-compose.yml` 提供隔离的容器化测试环境，无需本地 Python 环境。

```bash
# Run the full test suite in Docker  在 Docker 中运行完整测试套件
cd SG-CN/tests
docker-compose up --build --abort-on-container-exit

# Clean up  清理
docker-compose down
```

The compose file mounts the `SG-CN/` directory into the container and runs `pytest tests/ -v`.
compose 文件将 `SG-CN/` 目录挂载至容器并执行 `pytest tests/ -v`。

---

## Configuration / 配置说明

### `pytest.ini`

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- `asyncio_mode = auto` — all `async def` test functions are automatically treated as async tests; no `@pytest.mark.asyncio` decorator needed. / 所有 `async def` 测试函数自动识别为异步测试，无需装饰器。
- `testpaths = tests` — pytest discovery scoped to `tests/` only. / 测试发现范围限定为 `tests/` 目录。

### `requirements.txt` (tests/)

Core test dependencies: / 核心测试依赖：

```
pytest>=8.3
pytest-asyncio>=0.24
anyio>=4.6
respx>=0.21
httpx>=0.27          # must match runtime version
pytest-cov           # optional, for coverage reports
```

---

## Expected Output / 期望输出

A full passing run looks like: / 完整通过的运行输出如下：

```
========================= test session starts ==========================
platform linux -- Python 3.12.x, pytest-8.x.x, asyncio-0.24.x
collected 32 items

tests/test_auth.py::test_missing_auth_returns_401            PASSED
tests/test_auth.py::test_wrong_token_returns_401             PASSED
tests/test_auth.py::test_malformed_auth_scheme_returns_401   PASSED
tests/test_auth.py::test_no_auth_on_chat_returns_401         PASSED
tests/test_auth.py::test_health_requires_no_auth             PASSED

tests/test_health.py::test_health_ok_no_auth                 PASSED
tests/test_health.py::test_health_upstream_unreachable       PASSED
tests/test_health.py::test_health_returns_request_id         PASSED
tests/test_health.py::test_health_accepts_existing_request_id PASSED

tests/test_models.py::test_models_returns_list               PASSED
tests/test_models.py::test_models_fallback_on_upstream_timeout PASSED
tests/test_models.py::test_models_fallback_on_upstream_error PASSED
tests/test_models.py::test_models_normalizes_owned_by        PASSED

tests/test_chat.py::test_chat_text_message                   PASSED
tests/test_chat.py::test_chat_preserves_model_name           PASSED
tests/test_chat.py::test_chat_generates_fallback_id_when_missing PASSED
tests/test_chat.py::test_chat_forwards_temperature           PASSED
tests/test_chat.py::test_chat_upstream_timeout_returns_504   PASSED
tests/test_chat.py::test_chat_upstream_502_propagated        PASSED
tests/test_chat.py::test_chat_upstream_401_returns_502       PASSED
tests/test_chat.py::test_chat_multimodal_image_url           PASSED
tests/test_chat.py::test_chat_system_message                 PASSED
tests/test_chat.py::test_chat_streaming_response_content_type PASSED
tests/test_chat.py::test_chat_streaming_timeout_yields_error_event PASSED
tests/test_chat.py::test_chat_missing_messages_returns_422   PASSED
tests/test_chat.py::test_chat_missing_model_returns_422      PASSED

tests/test_adapters.py::test_adapt_request_plain_text        PASSED
tests/test_adapters.py::test_adapt_request_multimodal        PASSED
tests/test_adapters.py::test_adapt_request_excludes_none_fields PASSED
tests/test_adapters.py::test_adapt_request_includes_explicit_fields PASSED
tests/test_adapters.py::test_adapt_request_system_message    PASSED
tests/test_adapters.py::test_adapt_response_full             PASSED
tests/test_adapters.py::test_adapt_response_generates_fallback_id PASSED
tests/test_adapters.py::test_adapt_response_generates_created_timestamp PASSED
tests/test_adapters.py::test_adapt_response_handles_missing_usage PASSED
tests/test_adapters.py::test_adapt_response_multiple_choices PASSED
tests/test_adapters.py::test_adapt_model_list_standard_data_key PASSED
tests/test_adapters.py::test_adapt_model_list_models_key_fallback PASSED
tests/test_adapters.py::test_adapt_model_list_string_ids     PASSED
tests/test_adapters.py::test_adapt_model_list_empty          PASSED

========================= 40 passed in 2.34s ===========================
```

---

## CI Integration / 持续集成

Add the following to your GitHub Actions workflow / 添加到 GitHub Actions workflow：

```yaml
name: Gateway Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          cd SG-CN
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd SG-CN
          pytest tests/ -v --tb=short
```

---

## Notes / 注意事项

- Tests do **not** require a `.env` file — all credentials are injected by `conftest.py` / 测试无需 `.env` 文件，所有凭证由 `conftest.py` 注入
- Tests do **not** make real network calls — `respx.mock` intercepts everything / 测试不发起真实网络请求，`respx.mock` 拦截所有出站调用
- The flat `SG-CN/` layout means imports inside tests reference top-level modules directly: `from chat import ...`, not `from routes.chat import ...` / SG-CN 平铺结构意味着测试中直接引用顶层模块
- Run tests from the `SG-CN/` root, not from inside `tests/` / 请在 `SG-CN/` 根目录运行测试，而非在 `tests/` 内部

---

> **Gateway README:** `../README.md`
> **Contact / 联系:** [info@dcdeeptech.com](mailto:info@dcdeeptech.com)
