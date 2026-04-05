# 架构深度解析

> 本文档详细阐述"边缘-云正交解耦"架构的核心设计决策和工程实现细节。

---

## 一、为什么传统像素掩码不足以满足 PDPA 合规要求

### 传统方案的致命缺陷

在传统的隐私保护监控方案中，业界通常在边缘端部署轻量级人脸检测模型，
对检测到的 PII 区域（人脸、车牌）施加高斯模糊或全黑像素覆盖，
然后将处理后的图像帧传输至云端进行分析。

这种方案在面对现代 VLM 时已完全失效：

```
传统方案：原始图像 → [边缘端] 人脸模糊/遮盖 → 传输含 PII 上下文的像素 → [云端] VLM 分析
                                               ↑
                              ❌ 即便人脸被遮盖，VLM 仍可通过
                                 背景物体、步态、衣着等"混淆因素"
                                 逆向推断个人身份（超人类推断能力）
```

关键研究证明，最先进的 VLM 能够通过以下信息还原被遮挡者的身份特征：
- **步态特征**：人体姿态序列（即使单帧图像）
- **衣着纹理**：独特的服装纹样
- **周边交互对象**：个人随身物品、环境背景
- **行为模式**：动作序列的时间特征

### 本系统的解决方案：像素湮灭

```
本方案：原始图像 → [边缘端] ViT特征提取 → 原始像素物理销毁 → LDP噪声注入
                                                                    ↓
                              [中新IDC]  ←─── 传输匿名化特征向量（非像素）
                                                                    ↓
                              [云端] 接收抽象向量 → VLM语义对齐 → 生成文本
```

核心区别：**没有一个像素离开新加坡**。云端处理的是抽象的数学向量，
而非任何形式的视觉像素序列。

---

## 二、差分隐私在 VLM 场景的特殊考量

### 标准 LDP 面临的挑战

在自然语言处理（NLP）领域，差分隐私通常应用于词嵌入（Word Embeddings），
其敏感度（Sensitivity）相对容易界定（基于词汇表大小）。

但在视觉特征向量场景中，存在以下挑战：

**1. 高维度问题**
ViT-Large 输出 1024 维特征向量，每个 Patch 对应一个高维向量。
高维空间中，拉普拉斯分布的噪声能量在各维度平均分配，
可能需要更大的噪声尺度才能有效掩盖低维关键特征。

**解决方案**：使用特征向量归一化 + 范数裁剪（Norm Clipping）控制敏感度：
```python
# 裁剪后的L2范数不超过clip_norm，确保Δf准确
if self.clip_norm is not None:
    norm = np.linalg.norm(embeddings.flatten())
    if norm > self.clip_norm:
        embeddings = embeddings * (self.clip_norm / norm)
```

**2. 语义保持 vs 隐私保护的权衡**

| ε 值 | 噪声尺度 (Δf=1.0) | 余弦相似度保留率（估算） | 推理准确率影响 |
|------|------------------|----------------------|-------------|
| 0.1  | 10.0             | ~60%                 | 高（~15%下降）|
| 0.5  | 2.0              | ~80%                 | 中（~8%下降） |
| 1.0  | 1.0              | ~90%                 | 低（~3%下降） |
| 2.0  | 0.5              | ~95%                 | 极低（~1%下降）|

**实践建议**：
- 医疗影像（PDPA 高风险类别）：ε ≤ 0.5，接受更高的精度损失换取更强合规性
- 一般视觉任务（非 PII 密集场景）：ε = 1.0，在隐私保护和模型性能间取得平衡

**3. 重构攻击（Reconstruction Attack）防御**

理论上，如果攻击者掌握了完整的 ViT 解码器权重，
可以尝试通过梯度反向传播还原近似的原始图像。
LDP 的数学保证是：即便存在这样的攻击，
还原出的图像与真实图像在统计上无法区分（由 ε 界定）。

具体而言，对于拉普拉斯机制：

```
对任意相邻特征向量 x, x'（相差一个人的信息）：
P[M(x) ∈ S] ≤ exp(ε) × P[M(x') ∈ S]

当 ε = 1.0 时：exp(1.0) ≈ 2.72
即攻击者区分包含/不包含特定个人信息的概率差最多为 2.72 倍
（而非无限大，这正是 PDPC 要求的"不可逆"标准）
```

---

## 三、国密算法在跨司法管辖区通信中的选择依据

### 为什么不使用纯 TLS 1.3 + AES？

| 考量因素 | 纯 AES/RSA 方案 | 国密 SM 方案 |
|---------|---------------|------------|
| 中国合规性 | ❌ 可能违反国密合规要求 | ✅ 符合 GB 标准 |
| 新加坡兼容性 | ✅ 国际通用 | ✅ RFC 8998 已标准化 |
| 量子计算抵抗力 | ❌ RSA 面临量子威胁 | ✅ SM2 曲线参数相对安全 |
| 性能（小数据包） | 中等 | ✅ SM2 签名速度优于 RSA |
| 开源生态 | 完善 | 发展中（gmssl, TencentKona） |

### 混合加密体制的工程优势

```
握手阶段（低频，安全性优先）：SM2 非对称加密
  → 计算开销大但仅在连接建立时执行
  → 完美前向保密：每会话独立密钥

数据传输阶段（高频，性能优先）：SM4-GCM 对称加密
  → 硬件 AES 指令集加速（SM4 与 AES 结构相似）
  → 轻松跑满 260 Gbps 中新专用通道带宽

完整性校验（每包）：SM3 哈希
  → 256-bit 输出，与 SHA-256 性能相当
  → 同时用于 HMAC 和 KEM 中的密钥派生
```

---

## 四、中新 IDC 专用通道对 API 设计的影响

### 60ms 延迟的工程意义

人类对 UI 响应的"即时"感知阈值约为 100ms。
在 60-70ms 的 RTT 基础上，加上：
- 新加坡边缘端特征提取：~20ms（ViT-Small，CPU）
- 国密加密封装：~5ms
- TLS 1.3 握手（0-RTT 复用）：~10ms
- 重庆 AIDC 推理（72B 模型，首 Token）：~50ms

**总 TTFT（首字生成时间）≈ 145ms**，处于用户可接受范围内。

### HTTP/2 多路复用优化

```python
# 推荐在边缘客户端使用持久化连接池
import requests
from requests.adapters import HTTPAdapter

session = requests.Session()
adapter = HTTPAdapter(
    pool_connections=10,
    pool_maxsize=100,
    max_retries=3,
)
session.mount("https://", adapter)
# 在 SgEdgePrivacyClient 中使用 session 替代 requests.post
```

通过 HTTP/2 多路复用，多个并发的特征向量上传请求可共享同一 TCP 连接，
避免 TCP 慢启动和 TLS 握手开销，进一步降低多租户高并发场景下的延迟。

---

## 五、vLLM 外部视觉特征注入的工程挑战

标准 vLLM 的多模态输入管道期望接收：
1. 原始图像 URL / base64（再由内部 ViT 编码）
2. 文本 token 序列

本系统需要"绕过"第 1 步，直接将外部预计算的视觉特征注入到模型的
Cross-Attention 层。这需要对目标 VLM 模型进行架构级改造：

```python
# 以 Qwen-VL 为例，修改 modeling_qwen_vl.py 中的 forward 方法
class QwenVLModel(nn.Module):
    def forward(
        self,
        input_ids: torch.LongTensor,
        # 新增：接受外部预计算的视觉特征
        external_visual_features: Optional[torch.Tensor] = None,
        # 原有参数...
        pixel_values: Optional[torch.Tensor] = None,
    ):
        if external_visual_features is not None:
            # 直接使用外部特征，跳过内部 ViT 编码器
            visual_embeds = self.visual_projection(external_visual_features)
        elif pixel_values is not None:
            # 标准流程：内部 ViT 编码
            visual_embeds = self.visual_encoder(pixel_values)
        else:
            visual_embeds = None
        # 后续处理相同...
```

这种改造需要：
1. 确保边缘端 ViT 编码器与云端大模型使用**完全相同**的视觉编码器权重
2. 边缘端提取的特征维度与云端模型期望的输入维度**完全一致**
3. 特征归一化方式保持一致（LayerNorm 的均值/方差参数）

---

## 六、Kubernetes 生产部署架构

```yaml
# 建议的 K8s 部署拓扑（重庆 AIDC）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cq-aidc-vlm-gateway
spec:
  replicas: 3                    # 3 副本高可用
  selector:
    matchLabels:
      app: cq-aidc-gateway
  template:
    spec:
      containers:
      - name: gateway
        image: cq-aidc-gateway:latest
        resources:
          requests:
            nvidia.com/gpu: "8"  # 每 Pod 独占 8 块 GPU
          limits:
            nvidia.com/gpu: "8"
        volumeMounts:
        - name: model-storage
          mountPath: /mnt/models
        - name: sm2-keys
          mountPath: /opt/security/keys
          readOnly: true
      volumes:
      - name: model-storage
        persistentVolumeClaim:
          claimName: vlm-model-pvc
      - name: sm2-keys
        secret:
          secretName: aidc-sm2-keypair
          defaultMode: 0600     # 私钥权限强制限制
```

---

*文档结束。如需进一步了解某个模块的实现细节，请参阅对应源码文件中的文档字符串。*
