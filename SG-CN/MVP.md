# MVP.md — SG-CN AI Gateway · Minimal MVP

---

## English

### What is `mvp.py`?

`mvp.py` is a bare-minimum API gateway — a single Python file that accepts OpenAI-compatible chat requests from global clients, authenticates them with a Bearer token, and proxies the request through to the Sophnet inference cluster in China. It is designed to prove connectivity and end-to-end flow as fast as possible, with no abstractions.

```
Client  →  mvp.py (Singapore)  →  Sophnet vLLM (China)  →  Response
```

---

### Quick Start

**1. Install dependencies**

```bash
pip install fastapi uvicorn httpx python-dotenv
```

**2. Create `.env`**

```env
GATEWAY_API_KEY=your-gateway-key
SOPHNET_API_URL=https://your-sophnet-endpoint
SOPHNET_API_KEY=your-sophnet-key
```

**3. Run**

```bash
uvicorn mvp:app --host 0.0.0.0 --port 8000
```

**4. Test**

```bash
# Health check
curl http://localhost:8000/health

# Text inference
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer your-gateway-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwenvl","messages":[{"role":"user","content":"Hello"}]}'

# Streaming
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer your-gateway-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwenvl","stream":true,"messages":[{"role":"user","content":"Hello"}]}'
```

---

### Differences: `mvp.py` vs `main.py`

| Feature | `mvp.py` | `main.py` |
|---|---|---|
| Lines of code | ~44 | ~300+ |
| Purpose | Connectivity proof | Production-ready POC |
| Pydantic request validation | ✗ | ✓ |
| CORS middleware | ✗ | ✓ |
| `/v1/models` endpoint | ✗ | ✓ |
| Structured logging with request ID | ✗ | ✓ |
| Lifespan hook (graceful shutdown) | ✗ | ✓ |
| Protocol adapter (response normalisation) | Minimal | Full |
| Chinese annotations | ✗ | ✓ |
| Sophnet contract spec | ✗ | ✓ |
| Recommended for | Local dev / first test | Staging / POC demo |

**Rule of thumb:** use `mvp.py` to confirm Sophnet is reachable and the auth keys are correct. Switch to `main.py` for any shared or demo environment.

---

---

## 中文

### `mvp.py` 是什么？

`mvp.py` 是一个极简 API 网关——单个 Python 文件，接收全球客户端发来的 OpenAI 兼容请求，通过 Bearer Token 鉴权后，将请求直接转发至中国侧 Sophnet 推理集群，并将结果返回给客户端。设计目标：**最快速验证连通性和端到端流程**，无任何多余抽象。

```
客户端  →  mvp.py（新加坡）  →  Sophnet vLLM（中国）  →  返回响应
```

---

### 快速启动

**1. 安装依赖**

```bash
pip install fastapi uvicorn httpx python-dotenv
```

**2. 创建 `.env`**

```env
GATEWAY_API_KEY=你的网关密钥
SOPHNET_API_URL=https://sophnet推理入口地址
SOPHNET_API_KEY=sophnet提供的密钥
```

**3. 启动服务**

```bash
uvicorn mvp:app --host 0.0.0.0 --port 8000
```

**4. 测试**

```bash
# 健康检查
curl http://localhost:8000/health

# 文本推理
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer 你的网关密钥" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwenvl","messages":[{"role":"user","content":"你好"}]}'

# 流式输出
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer 你的网关密钥" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwenvl","stream":true,"messages":[{"role":"user","content":"你好"}]}'
```

---

### 对比：`mvp.py` vs `main.py`

| 功能 | `mvp.py` | `main.py` |
|---|---|---|
| 代码行数 | ~44 行 | ~300+ 行 |
| 定位 | 连通性验证 | 生产就绪 POC |
| Pydantic 请求校验 | ✗ | ✓ |
| CORS 跨域中间件 | ✗ | ✓ |
| `/v1/models` 接口 | ✗ | ✓ |
| 结构化日志 + 请求追踪 ID | ✗ | ✓ |
| 生命周期钩子（优雅关闭） | ✗ | ✓ |
| 协议适配（响应字段规范化） | 最小 | 完整 |
| 中文注释说明 | ✗ | ✓ |
| Sophnet 接口合约规范 | ✗ | ✓ |
| 适用场景 | 本地开发 / 首次联调 | 演示环境 / POC 阶段 |

**使用原则：** 用 `mvp.py` 确认 Sophnet 可达、密钥正确；一旦需要对外演示或多人共用，切换至 `main.py`。
