# 新加坡算力 API 中台（MVP）

> **电信级 FastAPI 网关** | 新加坡接入 · 重庆供给 · PDPA合规 · 主备切换

---

## 架构概览

```
外部客户
   │  HTTPS (TLS 1.3)
   ▼
┌─────────────────────────────────────────┐
│  Nginx  (TLS终止 + 反向代理)             │  新加坡节点
│  ─────────────────────────────────────  │
│  FastAPI Gateway                        │
│  ├─ RequestLifecycleMiddleware          │  request_id 注入 / 审计日志
│  ├─ RateLimitMiddleware                 │  QPS / 并发 / 日配额
│  ├─ API Key Auth (SHA-256 + Redis)      │  租户 / 项目 隔离
│  ├─ PDPA Filter                         │  最小必要字段过滤
│  └─ CQ Forwarder                        │  熔断器 + 主备切换
└─────────────────────────────────────────┘
          │  HTTPS / HTTP2  (中新数据通道)
          ▼
┌─────────────────────────────────────────┐
│  重庆后端模型服务                         │  重庆节点
│  ├─ 主节点 (Primary)                    │
│  └─ 备节点 (Standby)                    │
└─────────────────────────────────────────┘
```

---

## 目录结构

```
sg-api-gateway/
├── app/
│   ├── main.py                  # FastAPI 应用工厂 + 生命周期
│   ├── api/
│   │   ├── proxy.py             # 核心转发路由 /api/v1/forward
│   │   └── admin.py             # 管理接口 + 健康检查
│   ├── core/
│   │   ├── config.py            # 全局配置 (pydantic-settings)
│   │   ├── auth.py              # API Key 鉴权 + 租户隔离
│   │   └── logging.py           # 结构化日志 + PDPA审计日志
│   ├── middleware/
│   │   ├── lifecycle.py         # 请求生命周期 (request_id / 计时)
│   │   └── rate_limit.py        # 三层限流 (IP / 租户QPS / 日配额)
│   ├── models/
│   │   └── tenant.py            # 租户、API Key、请求数据模型
│   └── services/
│       ├── cq_forwarder.py      # 中新链路转发 + 熔断器 + 健康检查
│       └── pdpa_filter.py       # PDPA 合规字段过滤
├── tests/
│   └── test_gateway.py          # 完整测试套件 (pytest-asyncio)
├── nginx/
│   └── nginx.conf               # TLS终止 + 反向代理配置
├── scripts/
│   ├── quickstart.sh            # 一键启动脚本
│   └── api_examples.sh          # cURL 使用示例
├── Dockerfile                   # 多阶段构建，非root运行
├── docker-compose.yml           # 完整服务栈
├── .env.example                 # 环境变量模板
└── requirements.txt
```

---

## 快速启动

```bash
git clone <repo>
cd sg-api-gateway

# 一键启动（自动生成证书、.env、启动容器）
chmod +x scripts/quickstart.sh
./scripts/quickstart.sh
```

启动后保存输出中的 **Admin API Key**，后续管理操作需要使用。

### 验证服务

```bash
# 健康检查
curl -sk https://localhost/health | python3 -m json.tool

# 创建租户 Key
curl -sk -X POST https://localhost/admin/keys \
  -H "X-API-Key: <admin_key>" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "my-company", "project_id": "ai-demo", "rate_limit_qps": 20}'

# 转发推理请求（敏感字段自动过滤）
curl -sk -X POST https://localhost/api/v1/forward \
  -H "X-API-Key: <tenant_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/v1/chat/completions",
    "payload": {
      "model": "llama3",
      "messages": [{"role": "user", "content": "Hello"}],
      "nric": "S1234567A"
    }
  }'
# nric 字段将被自动阻断，不会到达重庆后端
```

---

## 核心模块说明

### 🔐 API Key 鉴权 (`app/core/auth.py`)

| 特性 | 说明 |
|------|------|
| 存储安全 | 原始 Key 永不落盘，仅存 SHA-256 哈希 |
| 防时序攻击 | `hmac.compare_digest` 恒定时间比较 |
| 租户隔离 | 每个 Key 绑定 `tenant_id` + `project_id` |
| 限流策略 | Key 级别自定义 QPS / 日配额 |
| 路径控制 | 可限制该 Key 只能访问指定后端路径 |
| 撤销即时生效 | 从 Redis 删除，下次请求立即拒绝 |

### 🛡️ PDPA 合规过滤 (`app/services/pdpa_filter.py`)

过滤优先级（高→低）：
1. 租户级自定义阻断字段
2. 全局 PDPA 阻断字段（`nric`, `email`, `phone` 等18个）
3. 租户级白名单（若配置，仅允许名单内字段通过）
4. 全局白名单（若配置）

每次跨境传输均生成审计记录写入 `pdpa-audit.log`：
```json
{
  "event": "CROSS_BORDER_DATA_TRANSFER",
  "ts": "2025-01-01T08:00:00+00:00",
  "request_id": "abc-123",
  "tenant_id": "acme-corp",
  "endpoint": "/v1/chat/completions",
  "destination": "Chongqing-CQ",
  "fields_forwarded_count": 4,
  "fields_forwarded": ["model", "messages", "temperature", "max_tokens"],
  "fields_blocked": ["nric(PDPA_BLOCKED)", "email(PDPA_BLOCKED)"],
  "legal_basis": "Singapore-Chongqing ICT Cooperation Framework / IMDA"
}
```

### 🔄 中新链路转发 (`app/services/cq_forwarder.py`)

- **主备路由**：优先主节点，不可用时自动切备
- **熔断器**：连续失败 N 次（默认5次）触发熔断，60秒后半开探测
- **重试策略**：指数退避，最大3次，只重试网络异常
- **健康检查**：后台每30秒异步探测主备节点
- **HTTP/2**：连接复用，减少延迟
- **超时分离**：连接超时5s，读取超时60s（推理任务专用）

### ⚡ 三层限流 (`app/middleware/rate_limit.py`)

| 层级 | Key | 限制 | 算法 |
|------|-----|------|------|
| IP 全局 | `rl:ip:{ip}` | 200次/分钟 | 滑动窗口 |
| 租户 QPS | `rl:tenant:{tid}:{pid}` | 按 Key 策略 | 滑动窗口 |
| 日配额 | `rl:daily:{tid}:{pid}:{date}` | 按 Key 策略 | 滑动窗口 |

所有限流基于 Redis，Redis 不可用时降级到本地内存（不跨实例）。

---

## 接口清单

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/health` | 无 | 完整健康状态（含后端链路） |
| GET | `/health/ready` | 无 | Kubernetes readiness probe |
| GET | `/health/live` | 无 | Kubernetes liveness probe |
| POST | `/api/v1/forward` | Tenant Key | 统一转发入口 |
| GET | `/api/v1/compliance/field-policy` | Tenant Key | PDPA字段策略查询 |
| POST | `/admin/keys` | Admin Key | 创建 API Key |
| DELETE | `/admin/keys` | Admin Key | 撤销 API Key |
| GET | `/admin/backend/status` | Admin Key | 后端链路详情 |
| GET | `/internal/metrics` | 无（内网） | Prometheus 指标 |

---

## 日志说明

| 文件 | 内容 | 保留期 |
|------|------|--------|
| `/var/log/sg-gateway/audit.log` | 所有请求审计日志（JSON） | 90天 |
| `/var/log/sg-gateway/pdpa-audit.log` | PDPA跨境传输专项日志（NDJSON，追加只写） | 90天+ |

---

## 安全说明

- 所有外部接口强制 HTTPS/TLS 1.2+
- API Key 仅在创建时返回一次，之后不可查询
- NRIC 等18类敏感字段永远不会出现在转发请求或日志中
- 管理接口（`/admin/*`）使用独立的 Admin Key，建议部署在内网
- Docker 容器以非 root 用户运行

---

## 运行测试

```bash
pip install -r requirements.txt
pytest tests/ -v
```

---

## 依赖版本

| 库 | 版本 | 用途 |
|----|------|------|
| FastAPI | 0.111 | Web 框架 |
| uvicorn | 0.30 | ASGI 服务器 |
| httpx | 0.27 | 异步 HTTP 客户端（转发） |
| redis | 5.0 | 限流 + Key 缓存 |
| structlog | 24.2 | 结构化日志 |
| tenacity | 8.3 | 重试策略 |
| pydantic | 2.7 | 数据验证 |
| prometheus-client | 0.20 | 指标暴露 |
