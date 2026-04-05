# CLAUDE.md — DCDeepTech AI Gateway 工程协作规范

本文件是面向 Claude Code 的工程协作指南。每次进入本仓库时，请先阅读本文件，遵循以下规范开展工作。

---

## 项目目的

本仓库是 **DCDeepTech 跨境合规 AI 推理网关**的全栈原型，包含：

- **新加坡控制面**：FastAPI 后端，负责认证、PII 检测、策略决策、审计日志
- **React 管理面板**：实时 GPU 监控、路由配置、聊天测试、API Key 管理
- **独立 API Key 系统**：`sk-dcdt-` 前缀，PBKDF2-HMAC-SHA256 哈希，Scope 权限控制
- **跨境路由策略**：PUBLIC/LOW_RISK → 重庆推理；PERSONAL → 新加坡脱敏后转发；HIGH_RISK → 阻断

---

## 工程原则

1. **不扩大范围**：只修改被要求的内容。不要在修 bug 时顺手重构周围代码，不要在加功能时添加未被要求的配置项或抽象。

2. **不猜测删除**：永远不要删除看起来"未使用"的代码，除非用户明确要求。本项目许多接口为未来扩展预留。

3. **安全优先**：
   - 密钥相关代码改动必须保持 PBKDF2 迭代次数 ≥ 260 000
   - `hmac.compare_digest` 不可替换为 `==`
   - 审计日志的 `_BLOCKED_FIELDS` 集合不可缩减，只可扩大
   - 上游 `UPSTREAM_API_KEY` 必须从环境变量注入，不得从客户端请求传递

4. **不写演示后门**：不添加绕过认证的 `debug=True` 开关或硬编码测试密钥。

5. **最小权限原则**：新增 API 路由默认要求认证；若需放开，须在代码注释中说明原因。

---

## 仓库约定

### 目录划分

| 路径 | 职责 |
|------|------|
| `src/` | React 18 + TypeScript 前端，纯 UI + 状态管理 |
| `backend/app/` | FastAPI 应用入口与路由注册 |
| `backend/keys/` | API Key 生命周期（生成、哈希、存储、服务、管理接口） |
| `backend/gateway/` | Auth 依赖、策略引擎、分发器 |
| `backend/security/` | PII 检测与脱敏 |
| `backend/audit/` | 审计日志（只写，不修改历史记录） |
| `backend/config/` | YAML 策略配置，不含业务逻辑代码 |

### 文件命名

- Python：`snake_case.py`
- TypeScript/React：`PascalCase.tsx`（组件），`camelCase.ts`（工具/hooks/store）
- 配置：`kebab-case.yaml`

### 提交粒度

- 每个逻辑变更一个 commit，不要把不相关修改堆在一起
- Commit message 以动词开头（英文），例如：`Add scope validation to require_auth`

---

## 请求路径规则

`POST /v1/chat/completions` 的处理流水线顺序**不可打乱**：

```
1. require_auth          → 验证 sk-dcdt- 密钥，获取 tenant_ctx
2. PiiDetector.detect()  → 检测 PII，计算 prompt_hash
3. Redactor.redact()     → 若需要，执行脱敏（逆序替换）
4. PolicyEngine.evaluate() → 根据数据分类决定路由或阻断
5. Dispatcher.dispatch() → 转发至 SG / CQ 上游
6. AuditLogger.log()     → 记录审计（成功与失败均需记录）
```

如需在流水线中插入新步骤，必须在代码注释中标注步骤编号和位置原因。

---

## API Key 规则

1. **完整密钥仅返回一次**：`CreateKeyResponse` 的 `key` 字段只在创建时出现；所有后续接口（列表、详情）只返回 `key_prefix`（前 16 字符 + `...`）。

2. **Key ID 格式**：`kdcdt_` 前缀 + 8字节随机值。Key 本体：`sk-dcdt-` 前缀 + 32字节随机值。不可更改前缀格式，否则前缀匹配认证逻辑会失效。

3. **认证逻辑**：`authenticate()` 先用前缀缩小候选集（`find_active_by_prefix_start`），再逐一 `verify_key`（`hmac.compare_digest`）。不可跳过前缀匹配步骤。

4. **状态机**：`active → disabled → active`（可逆）；`active/disabled → revoked`（终态）。代码中不得实现从 `revoked` 回到 `active` 的转换。

5. **哈希参数**：`_ITERATIONS = 260_000`（OWASP 2024 最低值）。降低此值视为安全漏洞。

---

## 安全规则

### 审计日志

`_BLOCKED_FIELDS`（`audit_logger.py`）列出**永远不得写入日志**的字段：

```python
_BLOCKED_FIELDS = frozenset({
    "messages", "raw_prompt", "prompt", "key", "api_key",
    "authorization", "pii_matches", "findings"
})
```

- 不得从此集合中移除任何字段
- 新增敏感字段时，先加入此集合，再添加到日志调用

### PII 检测

`detector.py` 中 `repr=False` 的 `match` 字段是为了防止 PII 值意外出现在日志中。**不得移除 `repr=False`**。

### 上游隔离

`dispatcher.py` 中注入上游 Authorization 的逻辑：

```python
headers["Authorization"] = f"Bearer {os.environ['UPSTREAM_API_KEY']}"
```

不得改为从请求头或请求体中读取客户端提供的值。

### CORS

`ALLOWED_ORIGINS` 来自环境变量，不得硬编码为 `["*"]`（通配符）用于生产。

---

## 前端规则

### 状态管理

- 所有全局状态在 `src/store.ts` 中以 slice 形式组织
- 组件通过 selector 订阅，不直接订阅整个 store
- `appendNodeMetric` 使用 60 点环形缓冲，不得改为无限增长的数组

### 性能约束

- `LogViewer.tsx` 的虚拟滚动逻辑（`ROW_HEIGHT = 26`，`overscan = 8`）不得替换为全量渲染
- `useMetricsSimulator.ts` 使用单个 `setInterval` 驱动所有节点，不得改为每节点一个计时器
- 图表组件保持 `isAnimationActive={false}`，避免大量数据点时的渲染卡顿

### 演示模式

前端在 `VITE_GATEWAY_URL` 未设置时使用 mock 数据（`mockData.ts`，`MOCK_KEYS`）。演示模式逻辑通过 `try/catch` + fallback 实现，不得在演示模式中绕过安全检查。

### API Key UI

`Keys/index.tsx` 中的 `KeyRevealModal` 在密钥创建后**仅弹出一次**，关闭后不可再次查看完整密钥。这是产品设计要求，不得修改为可重复查看。

---

## 配置文件规则

`backend/config/` 下的 YAML 文件由策略引擎和审计系统在运行时读取。修改时注意：

| 文件 | 安全影响 |
|------|----------|
| `transfer_rules.yaml` | 直接影响数据是否出境，改动须经法务确认 |
| `data_classes.yaml` | 分类 rank 变化会影响路由决策 |
| `subprocessor_allowlist.yaml` | `approved: false` 的条目不得在未审批前改为 `true` |
| `api_key_policy.yaml` | `hash_iterations` 不得低于 260000 |
| `retention_policy.yaml` | 审计保留期调整须符合 PDPA / PIPL 要求 |

---

## 文档要求

- **README.md**：覆盖全栈架构、API Key 模型、本地运行步骤、接口示例、审计说明、当前限制
- **CLAUDE.md**（本文件）：工程规范，每次重大架构变更后更新
- **代码注释**：仅在逻辑不自明时添加，不写"做了什么"只写"为什么这样做"

---

## 未来任务的预期输出

当用户要求新增功能时，输出应包含：

1. **修改清单**：列出需要新增 / 修改的文件
2. **代码实现**：完整文件内容或精确的 diff
3. **安全影响分析**：如涉及认证、日志、数据路由，需说明对现有安全机制的影响
4. **配置变更**：如需修改 YAML，提供完整更新后的文件
5. **README 更新**（如接口或环境变量有变化）

**不需要输出**：时间估算、进度百分比、无关的"此外你也可以考虑..."建议。

---

## 当前已知限制（工程视角）

- SQLite 不支持多进程并发写；生产环境须迁移至 PostgreSQL
- `dispatcher.py` 不支持 SSE 流式代理，`httpx` 目前为一次性响应
- `ADMIN_ALLOWED_CIDRS` 仅为配置占位，实际网络隔离需在反向代理层实现
- `admin:tenants` 和 `internal:routing` scope 已定义但无对应接口实现
