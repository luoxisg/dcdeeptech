# AI Gateway — DCDeepTech Cross-Border Inference Control Plane

跨境合规 AI 推理网关原型：**新加坡控制面 + 重庆推理面**，集成 LiteLLM 路由、vLLM 推理节点、PII 检测/脱敏、策略引擎、独立 `sk-dcdt-*` API Key 体系与 React 管理面板。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                    客户端 / SDK                                       │
│            Authorization: Bearer sk-dcdt-<token>                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│               新加坡控制面  (FastAPI)                                  │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │   Auth 层    │   │ PII 检测器   │   │     策略引擎            │  │
│  │ require_auth │──▶│  8 种正则    │──▶│  transfer_rules.yaml   │  │
│  │ PBKDF2-SHA256│   │ + SHA-256    │   │  data_classes.yaml     │  │
│  └──────────────┘   │   摘要       │   └────────────┬───────────┘  │
│                     └──────────────┘                │               │
│  ┌──────────────┐                                   ▼               │
│  │  审计日志    │◀──────────────────── ┌────────────────────────┐  │
│  │ (不含原文)   │                       │       分发器            │  │
│  └──────────────┘                       │   SG ◀──▶ CQ 路由      │  │
│                                         └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
        │ (PERSONAL / HIGH_RISK 留在 SG)        │ (PUBLIC / LOW_RISK)
        ▼                                        ▼
┌──────────────────────┐            ┌───────────────────────────────┐
│   SG LiteLLM Proxy   │            │    重庆 vLLM 推理集群          │
│   (脱敏后请求)        │            │   Llama-3 / Mistral 节点      │
└──────────────────────┘            └───────────────────────────────┘
```

### 数据分类与路由策略

| 分类 | 示例 | 传输策略 |
|------|------|----------|
| `PUBLIC` | 通用问答 | → 重庆（直传） |
| `LOW_RISK` | 技术文档、代码 | → 重庆（直传） |
| `PERSONAL` | 邮箱、电话、NRIC、护照 | → 仅新加坡（脱敏后） |
| `HIGH_RISK` | 信用卡号、多标识符组合 | 阻断 — `451 Unavailable For Legal Reasons` |

---

## 仓库结构

```
Vllm/
├── README.md
├── CLAUDE.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
│
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── seed_admin_key.py          # 首次运行，创建管理员 Key
│   │
│   ├── app/
│   │   ├── main.py                # FastAPI 入口，CORS，审计文件 handler
│   │   └── routers/
│   │       └── proxy.py           # POST /v1/chat/completions — 5 步流水线
│   │
│   ├── keys/
│   │   ├── generator.py           # sk-dcdt- 密钥生成，前缀提取
│   │   ├── hashing.py             # PBKDF2-HMAC-SHA256（260 000 次迭代）
│   │   ├── schemas.py             # Pydantic v2 模型
│   │   ├── repository.py          # SQLite WAL — api_keys 表 CRUD
│   │   ├── service.py             # 业务逻辑，lru_cache 单例
│   │   └── admin_routes.py        # FastAPI router: /admin/api-keys
│   │
│   ├── gateway/
│   │   ├── auth/
│   │   │   └── tenant_auth.py     # require_auth 依赖，require_scope()
│   │   ├── policy/
│   │   │   └── engine.py          # PolicyEngine，PolicyDecision 数据类
│   │   └── routing/
│   │       └── dispatcher.py      # 异步 httpx 分发至 SG / CQ
│   │
│   ├── security/
│   │   ├── pii/
│   │   │   └── detector.py        # 8 个编译正则，prompt_hash
│   │   └── redact/
│   │       └── redactor.py        # 逆序位置替换，类型标签
│   │
│   ├── audit/
│   │   └── audit_logger.py        # 结构化 JSON 审计，不含原始提示词
│   │
│   ├── inference/
│   │   └── adapters/
│   │       └── openai_compatible.py
│   │
│   └── config/
│       ├── api_key_policy.yaml
│       ├── data_classes.yaml
│       ├── transfer_rules.yaml
│       ├── subprocessor_allowlist.yaml
│       └── retention_policy.yaml
│
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types.ts
    ├── store.ts
    ├── mockData.ts
    ├── hooks/
    │   ├── useMetricsSimulator.ts
    │   └── useLogStream.ts
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── TopBar.tsx
    │   ├── StatusIndicator.tsx
    │   └── charts/
    │       ├── GpuUtilChart.tsx
    │       └── RequestRateChart.tsx
    └── views/
        ├── Dashboard/index.tsx
        ├── Playground/index.tsx
        ├── Routing/index.tsx
        ├── Nodes/
        │   ├── index.tsx
        │   └── NodeCard.tsx
        ├── Debug/
        │   ├── index.tsx
        │   ├── LogViewer.tsx
        │   └── LogFilterBar.tsx
        └── Keys/
            └── index.tsx
```

---

## API Key 模型

### 密钥格式

```
sk-dcdt-<32字节 url-safe base64 随机值>
```

- **Key ID**：`kdcdt_<8字节 url-safe base64 随机值>`
- **显示前缀**：前 16 个字符 + `...`（如 `sk-dcdt-AbCdEfGh...`）
- **完整密钥**：**仅在创建时返回一次** — 请立即保存
- **存储方式**：`(key_salt, pbkdf2_sha256_hash)` — 明文从不持久化

### Scope 权限表

| Scope | 说明 |
|-------|------|
| `chat:completions` | 调用 `/v1/chat/completions` |
| `embeddings` | 调用 `/v1/embeddings` |
| `admin:keys` | 创建 / 禁用 / 吊销 / 轮转 API Key |
| `admin:tenants` | 租户管理（待实现） |
| `internal:routing` | 读取路由规则（待实现） |

### Key 生命周期

```
active ──▶ disabled ──▶ active   (可重新启用)
       └──▶ revoked              (终态，不可恢复)
expired  ──▶ revoked             (认证时自动触发)
```

---

## 本地运行

### 前置条件

- Node.js ≥ 18
- Python ≥ 3.11
- （可选）运行中的 LiteLLM 或 vLLM 服务端点

### 1 — 前端

```bash
cd Vllm
npm install
npm run dev        # http://localhost:5173
```

未配置后端时，UI 自动进入**演示模式**，显示模拟节点、路由与 Key 数据。

### 2 — 后端

```bash
cd Vllm/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# 编辑 .env，填写 SG_LITELLM_URL、CQ_VLLM_URL、UPSTREAM_API_KEY 等
```

#### 初始化管理员 Key（仅执行一次）

```bash
python seed_admin_key.py
```

输出示例（**此密钥不会再次显示，请立即保存**）：

```
=== DCDeepTech Admin Key ===
Key ID  : kdcdt_xYzAbCdE
Key     : sk-dcdt-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
Prefix  : sk-dcdt-AAAAAAAA...
Scopes  : ['chat:completions', 'embeddings', 'admin:keys', 'admin:tenants']
===========================
```

#### 启动 API 服务

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3 — 前端连接后端

在项目根目录创建 `.env.local`：

```env
VITE_GATEWAY_URL=http://localhost:8000
```

---

## 环境变量参考

### 后端（`backend/.env`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `GATEWAY_HOST` | 否 | 监听地址（默认 `0.0.0.0`） |
| `GATEWAY_PORT` | 否 | 监听端口（默认 `8000`） |
| `SG_LITELLM_URL` | 是 | 新加坡 LiteLLM Proxy URL |
| `CQ_VLLM_URL` | 是 | 重庆 vLLM 基础 URL |
| `UPSTREAM_API_KEY` | 是 | 注入到上游的 Authorization（不来自客户端） |
| `KEY_DB_PATH` | 否 | SQLite 路径（默认 `keys.db`） |
| `ALLOWED_ORIGINS` | 否 | CORS 来源，逗号分隔 |
| `ADMIN_ALLOWED_CIDRS` | 否 | 允许调用 `/admin/*` 的 CIDR 列表 |

### 前端（`Vllm/.env.local`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_GATEWAY_URL` | 否 | 后端基础 URL。省略则进入演示模式。 |

---

## 接口示例

### 创建 API Key

```bash
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Authorization: Bearer sk-dcdt-<admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-acme",
    "description": "ACME 生产密钥",
    "scopes": ["chat:completions"],
    "expires_at": "2026-12-31T00:00:00Z"
  }'
```

响应（密钥**仅此一次**）：

```json
{
  "key_id": "kdcdt_xYzAbCdE",
  "key": "sk-dcdt-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "key_prefix": "sk-dcdt-AAAAAAAA...",
  "tenant_id": "tenant-acme",
  "scopes": ["chat:completions"],
  "created_at": "2026-04-03T10:00:00Z",
  "expires_at": "2026-12-31T00:00:00Z",
  "message": "Store this key securely — it will not be shown again."
}
```

### 聊天推理

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-dcdt-<tenant-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3-8b",
    "messages": [{"role": "user", "content": "用两句话解释 Transformer。"}]
  }'
```

### 含 PII 的请求（PERSONAL 分类 → SG 路由）

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-dcdt-<tenant-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3-8b",
    "messages": [{"role": "user", "content": "我的 NRIC 是 S1234567A，这个格式对吗？"}]
  }'
```

请求被分类为 `PERSONAL`，脱敏为 `我的 NRIC 是 [NATIONAL_ID]，这个格式对吗？`，仅转发至新加坡 LiteLLM Proxy。

### 高风险请求（阻断）

包含信用卡号的请求返回：

```
HTTP 451 Unavailable For Legal Reasons
{"detail": "Request blocked: HIGH_RISK data cannot be transferred under current policy"}
```

### Key 管理接口

```bash
# 列出所有 Key
curl http://localhost:8000/admin/api-keys \
  -H "Authorization: Bearer sk-dcdt-<admin-key>"

# 禁用 Key
curl -X POST http://localhost:8000/admin/api-keys/kdcdt_xYzAbCdE/disable \
  -H "Authorization: Bearer sk-dcdt-<admin-key>"

# 吊销 Key（终态）
curl -X POST http://localhost:8000/admin/api-keys/kdcdt_xYzAbCdE/revoke \
  -H "Authorization: Bearer sk-dcdt-<admin-key>"

# 轮转 Key（吊销旧 Key，返回新完整密钥）
curl -X POST http://localhost:8000/admin/api-keys/kdcdt_xYzAbCdE/rotate \
  -H "Authorization: Bearer sk-dcdt-<admin-key>"
```

---

## 审计与安全说明

### 每条请求的审计记录

写入 `backend/audit_logs/audit.jsonl`：

```json
{
  "timestamp": "2026-04-03T10:00:00.000Z",
  "event": "chat_completion",
  "key_id": "kdcdt_xYzAbCdE",
  "key_prefix": "sk-dcdt-AAAAAAAA...",
  "tenant_id": "tenant-acme",
  "model": "llama-3-8b",
  "data_class": "PERSONAL",
  "pii_types_found": ["NRIC_SG"],
  "prompt_hash": "sha256:aabbcc...",
  "destination_region": "sg",
  "route_name": "sg-redacted",
  "requires_redaction": true,
  "status_code": 200,
  "latency_ms": 342
}
```

### 永不记录的内容

- 原始提示词或补全文本
- 完整 API Key（仅记录 `key_id` 和 `key_prefix`）
- PII 匹配值（仅记录 PII 类型标签）
- `Authorization` 请求头

### 密钥存储

- PBKDF2-HMAC-SHA256，260 000 次迭代，32 字节随机盐（符合 OWASP 2024 最低标准）
- `api_keys` 表存储 `(key_salt, key_hash)` — 创建后明文立即丢弃
- 密钥比对使用 `hmac.compare_digest` 防止计时攻击

### 上游密钥隔离

客户端的 `sk-dcdt-*` 密钥**不会转发**至上游；上游 `UPSTREAM_API_KEY` 由服务端从环境变量注入。

---

## 当前限制

1. **管理员 Key 无 MFA**：`api_key_policy.yaml` 中 `require_mfa: false`；接入 MFA 提供商后置为 `true`
2. **SQLite 单节点**：如需高可用，将 `repository.py` 替换为 PostgreSQL 适配器
3. **ADMIN_ALLOWED_CIDRS 仅配置层**：生产部署须在上游防火墙或反向代理层强制执行
4. **无流式代理**：`/v1/chat/completions` 目前返回完整响应；SSE 流式传递尚未实现
5. **前端演示模式**：GPU 指标在本地模拟，不连接真实 vLLM（需设置 `VITE_GATEWAY_URL`）
6. **`openai-via-sg` 子处理商**：`subprocessor_allowlist.yaml` 中标记为 `approved: false`，等待法务审核
7. **Key 轮转窗口**：轮转接口原子性创建新 Key 并吊销旧 Key，客户端需在同一请求内更新存储的密钥

---

## 性能设计

| 机制 | 位置 | 说明 |
|------|------|------|
| 虚拟滚动 | `LogViewer.tsx` | 最多 2000 条日志，DOM 始终仅渲染约 30 行 |
| 环形缓冲 | `store.ts` `appendNodeMetric` | 每节点保留 60 秒 GPU 历史，超出自动丢弃 |
| 单计时器 | `useMetricsSimulator.ts` | 所有节点 GPU 指标由根组件单个 `setInterval` 驱动 |
| 选择性订阅 | Zustand selector | 组件仅在关心的数据变化时重渲染 |
| React.memo | `NodeCard` `MessageBubble` `LogRow` 图表 | 避免父组件重渲染导致的子组件无效渲染 |
| PBKDF2 缓存 | `lru_cache` singleton | `ApiKeyService` 实例复用，避免重复初始化 |

---

## 可用脚本

```bash
# 前端
npm run dev          # 开发服务器（http://localhost:5173）
npm run build        # 生产构建，输出 dist/
npm run preview      # 本地预览生产包
npx tsc --noEmit     # 仅 TypeScript 类型检查

# 后端
python seed_admin_key.py                             # 创建首个管理员 Key
uvicorn app.main:app --reload                        # 开发模式启动
uvicorn app.main:app --host 0.0.0.0 --port 8000     # 生产模式启动
```

---

## Roadmap

- [ ] PostgreSQL 后端替换 `ApiKeyRepository`
- [ ] SSE 流式代理（`dispatcher.py`）
- [ ] 管理员 Scope 的 MFA 强制校验
- [ ] 租户管理 UI（`admin:tenants` scope）
- [ ] PDPA / PIPL 合规报告导出（审计日志聚合）
- [ ] 基于 `key_id` 的速率限制（滑动窗口，Redis）
- [ ] Kubernetes Helm Chart（SG + CQ 双集群）
- [ ] OpenTelemetry 全链路追踪（SG → CQ 跨域传播）

---

## License

内部原型 — DCDeepTech。不得公开分发。
