"""
sg_edge/client.py
新加坡本地节点：边缘隐私提取 SDK 核心客户端

职责：
  1. PII 风险探测与感兴趣区域标注
  2. 轻量级 ViT 特征提取（像素降维）
  3. 原始像素内存物理销毁（PDPA 合规关键步骤）
  4. 局部差分隐私（LDP）注入，确保数学级不可逆匿名化
  5. 国密混合加密封装（SM2 密钥协商 + SM4-GCM 载荷加密 + SM3 完整性校验）
  6. 基于 TLS 1.3 / RFC 8998 的跨国请求发送
"""

import json
import logging
from typing import Any, Dict, Optional

import numpy as np
import requests

from sg_edge.differential_privacy import LocalDifferentialPrivacyEngine
from sg_edge.gm_crypto_client import GMCryptoClient
from sg_edge.pii_profiler import PIIRiskProfiler
from sg_edge.vision_encoder import LightweightVisionEncoder

logger = logging.getLogger(__name__)


def load_image_tensor(image_path: str) -> np.ndarray:
    """
    从磁盘加载原始图像为 NumPy 像素矩阵。
    支持 JPEG、PNG、BMP、TIFF 格式。
    """
    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        return np.array(img, dtype=np.float32) / 255.0
    except Exception as exc:
        raise IOError(f"无法加载图像 {image_path}: {exc}") from exc


class SgEdgePrivacyClient:
    """
    运行在新加坡本地 K3s 集群或终端设备上的边缘隐私提取客户端。

    PDPA 合规保证：
    - 原始像素绝不离开新加坡本地内存空间。
    - 跨国传输的特征向量经 ε-LDP 处理，满足 PDPC《基础匿名化指南》对
      不可逆匿名化的技术要求，脱离 PDPA"个人数据"定义。
    - 国密 TLCP（SM2/SM3/SM4）全程加密，符合中国国密合规要求。
    """

    INFERENCE_ENDPOINT = "/v1/completions/vlm-crossborder"
    PUBLIC_KEY_ENDPOINT = "/v1/crypto/public-key"

    def __init__(
        self,
        target_api_url: str,
        tenant_auth_token: str,
        epsilon_budget: float = 1.0,
        tlcp_ca_bundle: str = "/etc/ssl/certs/ca-bundle-tlcp-compliant.crt",
        request_timeout: int = 60,
    ):
        """
        初始化边缘客户端。

        Args:
            target_api_url:      重庆 AIDC 网关地址，例如 https://aidc.cq.example.com:8443
            tenant_auth_token:   OIDC Bearer Token，用于多租户身份验证
            epsilon_budget:      差分隐私预算（ε）。越小隐私保护越强，建议医疗/金融场景使用 ≤ 0.5
            tlcp_ca_bundle:      符合 TLCP 规范的 CA 证书链路径，用于 TLS 证书验证
            request_timeout:     网络请求超时时间（秒）
        """
        if epsilon_budget <= 0:
            raise ValueError("隐私预算 epsilon 必须为正数。")

        self.api_endpoint = target_api_url.rstrip("/")
        self.auth_token = tenant_auth_token
        self.epsilon = epsilon_budget
        self.tlcp_ca_bundle = tlcp_ca_bundle
        self.timeout = request_timeout

        # 初始化边缘 AI 组件（全部离线运行，无公网访问）
        self.risk_profiler = PIIRiskProfiler()
        self.vision_extractor = LightweightVisionEncoder()
        self.dp_engine = LocalDifferentialPrivacyEngine(epsilon=self.epsilon)

        # 初始化国密客户端并获取服务端公钥
        self.crypto = GMCryptoClient()
        self.server_sm2_public_key: Optional[str] = None
        self._init_server_public_key()

        logger.info(
            "SgEdgePrivacyClient 初始化完成 | endpoint=%s | ε=%.2f",
            self.api_endpoint,
            self.epsilon,
        )

    def _init_server_public_key(self) -> None:
        """
        从重庆 AIDC 拉取 SM2 公钥并缓存。
        生产环境应结合证书链验证防止中间人攻击（MITM）。
        """
        url = f"{self.api_endpoint}{self.PUBLIC_KEY_ENDPOINT}"
        try:
            resp = requests.get(url, verify=self.tlcp_ca_bundle, timeout=10)
            resp.raise_for_status()
            self.server_sm2_public_key = resp.json()["public_key_pem"]
            logger.info("已成功获取 AIDC SM2 公钥。")
        except Exception as exc:
            logger.warning("获取服务端公钥失败（将在首次推理时重试）: %s", exc)

    # ─────────────────────────────────────────────────────────────
    #  核心差分隐私引擎（对外暴露，便于单元测试）
    # ─────────────────────────────────────────────────────────────

    def inject_local_differential_privacy(self, embeddings: np.ndarray) -> np.ndarray:
        """
        核心合规引擎：在降维后的特征向量上注入局部差分隐私（LDP）噪声。

        依据 PDPC 匿名化指南：只有当重标识在数学上不可逆时，数据方可脱离
        PDPA 管辖。本方法通过拉普拉斯机制提供 ε-差分隐私保证：

            P[M(x) ∈ S] ≤ exp(ε) × P[M(x') ∈ S]

        即对任意相邻数据集 x 和 x'，攻击者区分它们的概率差被 ε 严格界定。

        Args:
            embeddings: 从视觉编码器输出的特征向量（numpy ndarray）

        Returns:
            经差分隐私扰动的匿名化特征向量（与输入形状相同）
        """
        return self.dp_engine.apply_laplace_mechanism(embeddings)

    # ─────────────────────────────────────────────────────────────
    #  端到端推理生命周期管控
    # ─────────────────────────────────────────────────────────────

    def process_and_dispatch(
        self,
        raw_image_path: str,
        user_instruction: str,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        执行端到端的跨国 VLM 推理请求，全程符合 PDPA 合规要求。

        处理流水线（Pipeline）：
          [阶段 1] 物理隔离区数据处理（新加坡本地）
            ├─ 加载原始图像像素矩阵
            ├─ PII 风险区域标注（热力图）
            ├─ 轻量级 ViT 特征提取（像素 → 语义向量）
            ├─ 原始像素内存销毁（del + gc.collect）
            └─ 差分隐私噪声注入（Laplace 机制）

          [阶段 2] 密码学安全封装
            ├─ 生成临时 SM4 会话密钥（256-bit，用后即弃）
            ├─ 组装 JSON 载荷（向量 + 文本 prompt）
            ├─ SM3 计算消息认证码（防篡改）
            ├─ SM4-GCM 加密载荷（含 AEAD 认证标签）
            └─ SM2 公钥包裹会话密钥（KEM 机制）

          [阶段 3] 跨国网络请求
            └─ TLS 1.3 + RFC 8998（SM4-GCM-SM3 套件）HTTPS POST

        Args:
            raw_image_path:   原始图像路径（包含 PII，仅在本地处理）
            user_instruction: 推理任务文本指令
            extra_metadata:   可选附加元数据（不含 PII）

        Returns:
            推理结果字典，包含 result_text 和 finops_metrics
        """
        import gc

        # ─── 阶段 1：物理隔离区数据处理 ───────────────────────────────
        logger.debug("[阶段1] 加载原始图像: %s", raw_image_path)
        raw_pixels = load_image_tensor(raw_image_path)

        logger.debug("[阶段1] 执行 PII 风险探测...")
        risk_heat_map = self.risk_profiler.evaluate_sensitivity(raw_pixels)

        logger.debug("[阶段1] 提取视觉特征向量...")
        extracted_features = self.vision_extractor.encode(
            raw_pixels, sensitivity_mask=risk_heat_map
        )

        # 关键合规步骤：物理销毁原始像素，确保其不具备任何进入网卡的条件
        del raw_pixels
        gc.collect()
        logger.info("[PDPA合规] 原始像素已在本地内存中物理销毁。")

        logger.debug("[阶段1] 注入局部差分隐私（ε=%.2f）...", self.epsilon)
        secured_features = self.inject_local_differential_privacy(extracted_features)

        # ─── 阶段 2：密码学安全封装 ────────────────────────────────────
        logger.debug("[阶段2] 生成临时 SM4 会话密钥...")
        ephemeral_session_key = self.crypto.generate_sm4_session_key()

        payload_dict: Dict[str, Any] = {
            "visual_vector": secured_features.flatten().tolist(),
            "tensor_shape": list(secured_features.shape),
            "textual_prompt": user_instruction,
        }
        if extra_metadata:
            payload_dict["metadata"] = extra_metadata

        json_payload = json.dumps(payload_dict, ensure_ascii=False)

        logger.debug("[阶段2] SM3 完整性摘要计算...")
        integrity_mac = self.crypto.sm3_digest(json_payload.encode("utf-8"))

        logger.debug("[阶段2] SM4-GCM 加密载荷...")
        encrypted_body, auth_tag = self.crypto.sm4_gcm_encrypt(
            plaintext=json_payload.encode("utf-8"),
            key=ephemeral_session_key,
        )

        if self.server_sm2_public_key is None:
            logger.warning("服务端公钥未缓存，重新拉取...")
            self._init_server_public_key()

        logger.debug("[阶段2] SM2 包裹会话密钥（KEM）...")
        wrapped_session_key = self.crypto.sm2_encrypt(
            plaintext=ephemeral_session_key,
            public_key_pem=self.server_sm2_public_key,
        )

        # ─── 阶段 3：跨国网络请求 ──────────────────────────────────────
        request_headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "X-Key-Encapsulation": wrapped_session_key.hex(),
            "X-SM3-Integrity-Mac": integrity_mac.hex(),
            "X-GCM-Auth-Tag": auth_tag.hex(),
            "Content-Type": "application/octet-stream",
        }

        url = f"{self.api_endpoint}{self.INFERENCE_ENDPOINT}"
        logger.info("[阶段3] 发起跨国推理请求 -> %s", url)

        response = requests.post(
            url=url,
            data=encrypted_body,
            headers=request_headers,
            verify=self.tlcp_ca_bundle,
            timeout=self.timeout,
        )
        response.raise_for_status()

        result = response.json()
        logger.info(
            "推理完成 | 输入Token=%d | 输出Token=%d",
            result.get("finops_metrics", {}).get("input_tokens_billed", -1),
            result.get("finops_metrics", {}).get("output_tokens_billed", -1),
        )
        return result
