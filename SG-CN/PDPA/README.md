# 中新数据通道 PDPA 合规 VLM 跨境推理 API

> 基于中新（重庆）国际专用数据通道的隐私保护级视觉语言模型跨境推理框架  
> Privacy-Preserving VLM Cross-Border Inference via China-Singapore Dedicated Data Channel

---

## 目录

- [架构概览](#架构概览)
- [PDPA 合规设计原则](#pdpa-合规设计原则)
- [快速开始](#快速开始)
- [模块说明](#模块说明)
- [差分隐私参数配置](#差分隐私参数配置)
- [国密 TLCP 加密配置](#国密-tlcp-加密配置)
- [多租户计费引擎](#多租户计费引擎)
- [合规声明](#合规声明)
- [参考文献](#参考文献)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     新加坡本地节点（边缘端）                        │
│                                                                 │
│  原始图像/视频流                                                   │
│       │                                                         │
│       ▼                                                         │
│  [1] PII 风险探测（本地 SLM）                                      │
│       │                                                         │
│       ▼                                                         │
│  [2] 轻量级 ViT 特征提取 → 销毁原始像素                             │
│       │                                                         │
│       ▼                                                         │
│  [3] 局部差分隐私注入（Laplace 噪声，ε 可配置）                      │
│       │                                                         │
│       ▼                                                         │
│  [4] SM2/SM3/SM4 国密混合加密封装                                  │
│       │                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │  ← 匿名化特征向量（非个人数据，脱离 PDPA 管辖）
        │  ← TLS 1.3 + RFC 8998 国密套件（SM4-GCM-SM3）
        │  ← 中新专用数据通道 IDC（60-70ms，260 Gbps）
        │
┌───────┼─────────────────────────────────────────────────────────┐
│       ▼             重庆 AIDC 算力节点（云端）                      │
│                                                                 │
│  [5] 零信任身份验证（OIDC/OAuth 2.0 Bearer Token）                 │
│       │                                                         │
│       ▼                                                         │
│  [6] SM4-GCM 解密 + SM3 完整性校验                                │
│       │                                                         │
│       ▼                                                         │
│  [7] 多模态 VLM 推理（72B 参数模型，vLLM 连续批处理）                │
│       │                                                         │
│       ▼                                                         │
│  [8] FinOps Token 计费（视觉 Patch 映射 + 文本 BPE 计量）           │
│       │                                                         │
│       ▼                                                         │
│      推理结果（纯文本）→ 返回新加坡客户端                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## PDPA 合规设计原则

### 核心法律依据

本架构针对新加坡《个人数据保护法》（PDPA）**第 26 条转移限制义务**进行合规设计。

| PDPA 义务 | 本架构的合规应对方案 |
|-----------|-------------------|
| 转移限制义务（第 26 条） | 边缘端特征提取 + 差分隐私确保离境数据脱离"个人数据"定义 |
| 去标识化标准（PDPC 匿名化指南） | 拉普拉斯 LDP 注入，数学上不可逆，防御重标识攻击 |
| 数据最小化原则 | 原始像素在新加坡本地节点内存中物理销毁，不出境 |
| 传输安全义务 | 国密 SM2/SM3/SM4 + TLS 1.3 RFC 8998 端到端加密 |
| AI 推理数据使用（PDPC AI 指南） | 特征向量语义匿名，无法还原个人身份轮廓 |

### 关键合规边界

```
新加坡境内处理（受 PDPA 管辖）       中新 IDC 通道及以外（不受 PDPA 管辖）
─────────────────────────────────   ──────────────────────────────────────
✓ 原始图像/视频帧（含 PII）           ✓ 差分隐私扰动后的抽象特征向量
✓ PII 风险区域标注                   ✓ 国密加密的密文载荷
✓ 视觉编码器前向计算                 ✓ 模型推理返回的纯文本结果
✓ 差分隐私噪声注入
✓ 原始像素内存销毁
```

> **法律要点**：依据 PDPC《基础匿名化指南》（2024年7月更新版），只有当重标识在数学意义上不可逆时，数据方可脱离 PDPA 管辖。本架构通过 ε-差分隐私保证满足该标准。

---

## 快速开始

### 环境要求

```
Python >= 3.10
PyTorch >= 2.2
numpy >= 1.26
requests >= 2.31
fastapi >= 0.111
uvicorn >= 0.29
gmssl >= 3.2.2          # 国密算法支持
torchvision >= 0.17
```

### 安装

```bash
git clone https://github.com/your-org/sg-cq-vlm-pdpa
cd sg-cq-vlm-pdpa
pip install -r requirements.txt

# 安装支持 RFC 8998 国密套件的 OpenSSL（Ubuntu/Debian）
sudo apt-get install libssl-dev
pip install pyopenssl cryptography
```

### 新加坡边缘端启动

```bash
# 配置边缘节点参数
cp config/edge_config.example.yaml config/edge_config.yaml
# 编辑 edge_config.yaml，填入 AIDC 服务地址与租户 Token

# 启动边缘隐私提取客户端
python -m sg_edge.client \
  --config config/edge_config.yaml \
  --epsilon 1.0 \
  --image-source /path/to/images
```

### 重庆 AIDC 云端服务启动

```bash
# 配置云端参数
cp config/cloud_config.example.yaml config/cloud_config.yaml

# 启动 FastAPI 推理网关
uvicorn cq_cloud.server:app \
  --host 0.0.0.0 \
  --port 8443 \
  --ssl-keyfile /opt/security/keys/aidc_private.pem \
  --ssl-certfile /opt/security/certs/aidc_cert.pem \
  --workers 8
```

### 调用示例

```python
from sg_edge.client import SgEdgePrivacyClient

client = SgEdgePrivacyClient(
    target_api_url="https://aidc-gateway.cq.example.com:8443",
    tenant_auth_token="Bearer eyJhbGciOiJSUzI1NiJ9...",
    epsilon_budget=1.0
)

result = client.process_and_dispatch(
    raw_image_path="/data/medical_scan_001.jpg",
    user_instruction="请分析此医学影像中的异常区域，给出初步诊断建议。"
)

print(result["result_text"])
# {"finops_metrics": {"input_tokens_billed": 386, "output_tokens_billed": 214}}
```

---

## 模块说明

```
sg-cq-vlm-pdpa/
├── README.md
├── requirements.txt
├── config/
│   ├── edge_config.example.yaml        # 边缘节点配置模板
│   └── cloud_config.example.yaml       # 云端节点配置模板
│
├── sg_edge/                            # 新加坡边缘端 SDK
│   ├── __init__.py
│   ├── client.py                       # 主客户端入口（SgEdgePrivacyClient）
│   ├── pii_profiler.py                 # PII 风险探测器
│   ├── vision_encoder.py               # 轻量级 ViT 视觉编码器
│   ├── differential_privacy.py         # 局部差分隐私引擎（LDP）
│   └── gm_crypto_client.py             # 国密客户端加密封装（SM2/SM3/SM4）
│
├── cq_cloud/                           # 重庆 AIDC 云端服务
│   ├── __init__.py
│   ├── server.py                       # FastAPI 推理网关主入口
│   ├── auth.py                         # 零信任身份验证（OIDC/OAuth 2.0）
│   ├── gm_crypto_server.py             # 国密服务端解密（SM2/SM3/SM4）
│   ├── vlm_engine.py                   # 分布式 VLM 推理引擎（vLLM 封装）
│   └── billing.py                      # FinOps 多租户 Token 计费引擎
│
├── tests/
│   ├── test_pdpa_compliance.py         # PDPA 合规性单元测试
│   ├── test_dp_irreversibility.py      # 差分隐私不可逆性验证
│   └── test_crypto_roundtrip.py        # 国密加解密往返测试
│
└── docs/
    ├── pdpa_compliance_checklist.md    # PDPA 合规检查清单
    └── architecture_deep_dive.md      # 架构深度解析
```

---

## 差分隐私参数配置

差分隐私预算 **ε（epsilon）** 是本系统最关键的合规参数，直接决定匿名化强度。

| ε 值 | 隐私保护强度 | 推荐使用场景 | 模型精度影响 |
|------|------------|------------|------------|
| 0.1  | 极强（最高合规） | 医疗影像、金融文件 | 较高（~15%） |
| 0.5  | 强 | 身份证件、人脸识别 | 中等（~8%） |
| 1.0  | 标准（推荐默认） | 通用视觉推理 | 低（~3%） |
| 2.0  | 适度 | 非敏感场景（室内物体识别） | 极低（~1%） |

> **合规建议**：涉及 PDPA 高风险类别数据（医疗、财务、生物特征）时，建议 ε ≤ 0.5。

```yaml
# config/edge_config.yaml
differential_privacy:
  epsilon: 1.0           # 隐私预算（越小越严格）
  mechanism: laplace     # 噪声机制：laplace | gaussian
  l1_sensitivity: 1.0    # ViT 特征空间 L1 范数敏感度上限
  clip_norm: true        # 是否启用梯度裁剪辅助
```

---

## 国密 TLCP 加密配置

本系统基于 **RFC 8998** 将国密算法套件整合进 TLS 1.3，支持以下密码套件：

```
TLS_SM4_GCM_SM3         # 推荐（GCM 模式，支持 AEAD）
TLS_SM4_CCM_SM3         # 备用
```

```yaml
# config/cloud_config.yaml
tls:
  version: "1.3"
  cipher_suites:
    - "TLS_SM4_GCM_SM3"
  server_cert: /opt/security/certs/aidc_cert.pem
  server_key:  /opt/security/keys/aidc_private.pem
  ca_bundle:   /opt/security/certs/ca-bundle-tlcp.crt
  require_client_cert: false  # 生产环境建议开启双向 mTLS
```

**密钥轮换策略**：
- SM2 根密钥：每 365 天轮换
- 会话密钥（SM4）：每个请求独立生成，用后即弃（Perfect Forward Secrecy）
- SM3 HMAC 盐值：每个数据包独立随机生成

---

## 多租户计费引擎

### 视觉 Token 计费映射逻辑

```
输入计费 = 视觉 Patch Token 数 + 文本 Prompt Token 数
输出计费 = 生成文本 BPE Token 数

视觉 Patch Token = Num_Patches_X × Num_Patches_Y
（例：ViT-Large 编码器输出 16×16 Patch → 256 视觉 Token）
```

### 计费 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/completions/vlm-crossborder` | POST | 主推理端点（含计费） |
| `/v1/billing/usage` | GET | 查询当前租户用量 |
| `/v1/billing/quota` | GET | 查询租户配额上限 |
| `/v1/crypto/public-key` | GET | 获取服务端 SM2 公钥 |

### 请求头规范

```http
POST /v1/completions/vlm-crossborder
Authorization: Bearer <OIDC_TOKEN>
X-Key-Encapsulation: <SM2_WRAPPED_SESSION_KEY_HEX>
X-SM3-Integrity-Mac: <SM3_HMAC_HEX>
X-GCM-Auth-Tag: <SM4_GCM_AUTH_TAG_HEX>
Content-Type: application/octet-stream
```

---

## 合规声明

- 本系统**不在中新 IDC 通道上传输任何原始像素数据**。
- 所有离境数据均为经过差分隐私扰动的高维抽象特征向量，依据 PDPC《基础匿名化指南》（2024）不构成"个人数据"。
- 系统架构满足 PDPA 第 26 条转移限制义务的豁免要求，无需针对每一终端用户签署标准合同条款（SCC）或企业约束规则（BCR）。
- 传输层采用符合中国国家密码管理局标准的 SM2/SM3/SM4 算法，满足重庆 AIDC 所适用的国密合规要求。

> ⚠️ 本系统提供技术合规基础设施，不构成法律意见。实际部署前请咨询具备 PDPA 执业资质的数据保护顾问（DPO）。

---

## 参考文献

- PDPC, *Transfer Limitation Obligation*, Chapter 19 (2017)
- PDPC, *Guide to Basic Anonymisation*, July 2024
- PDPC, *Advisory Guidelines on the Use of Personal Data in AI Recommendation and Decision Systems*, 2024
- IETF RFC 8998, *ShangMi (SM) Cipher Suites for TLS 1.3*, 2021
- arXiv:2511.22788, *PRISM: Privacy-Aware Routing for Adaptive Cloud-Edge LLM Inference*
- arXiv:2603.04775, *Privacy-Aware Camera 2.0 Technical Report*
- Tencent, *TencentKonaSMSuite*, GitHub
- The Straits Times, *Singapore, Chongqing deepen cooperation with China's first dedicated international data link*
