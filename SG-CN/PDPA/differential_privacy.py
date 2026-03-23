"""
sg_edge/differential_privacy.py
局部差分隐私（Local Differential Privacy）引擎

实现基于拉普拉斯机制（Laplace Mechanism）的 ε-差分隐私保证。
这是本系统满足 PDPC《基础匿名化指南》不可逆匿名化标准的核心数学工具。

理论依据：
  拉普拉斯机制：M(x) = f(x) + Lap(Δf / ε)
  其中：
    - Δf：全局 L1 敏感度（特征函数 f 在相邻输入间的最大变化量）
    - ε：隐私预算（privacy budget），控制隐私保护强度
    - Lap(b)：均值为 0、尺度参数为 b 的拉普拉斯分布

PDPA 合规意义：
  注入噪声后，即便攻击者掌握完整的解码器权重，也无法以超过
  exp(ε) 的概率比确认输入中是否包含特定个人的视觉信息，
  满足 PDPC 对"重标识在数学上不可逆"的匿名化标准。
"""

import logging
from enum import Enum
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


class NoiseMechanism(str, Enum):
    """支持的差分隐私噪声机制。"""
    LAPLACE = "laplace"
    GAUSSIAN = "gaussian"


class LocalDifferentialPrivacyEngine:
    """
    ε-局部差分隐私引擎。

    支持拉普拉斯机制（Laplace）和高斯机制（Gaussian）。
    推荐在 VLM 特征向量场景下使用拉普拉斯机制（L1 敏感度定义更自然）。
    """

    # ViT 特征空间 L1 范数敏感度上限（归一化特征向量的默认值）
    DEFAULT_L1_SENSITIVITY = 1.0
    # 高斯机制所需的 δ（失败概率上限），通常设为 1/n²（n 为数据集大小）
    DEFAULT_GAUSSIAN_DELTA = 1e-5

    def __init__(
        self,
        epsilon: float,
        mechanism: NoiseMechanism = NoiseMechanism.LAPLACE,
        l1_sensitivity: float = DEFAULT_L1_SENSITIVITY,
        l2_sensitivity: float = DEFAULT_L1_SENSITIVITY,
        delta: float = DEFAULT_GAUSSIAN_DELTA,
        clip_norm: Optional[float] = None,
    ):
        """
        Args:
            epsilon:         隐私预算（ε > 0）。越小越严格。
                             PDPA 高风险场景建议 ε ≤ 0.5。
            mechanism:       噪声机制（Laplace 或 Gaussian）
            l1_sensitivity:  特征函数的全局 L1 敏感度（Laplace 机制使用）
            l2_sensitivity:  特征函数的全局 L2 敏感度（Gaussian 机制使用）
            delta:           高斯机制的失败概率参数（δ）
            clip_norm:       可选的特征向量裁剪范数上限（辅助控制敏感度）
        """
        if epsilon <= 0:
            raise ValueError(f"隐私预算 epsilon 必须为正数，当前值: {epsilon}")

        self.epsilon = epsilon
        self.mechanism = mechanism
        self.l1_sensitivity = l1_sensitivity
        self.l2_sensitivity = l2_sensitivity
        self.delta = delta
        self.clip_norm = clip_norm

        logger.info(
            "LDP 引擎初始化 | 机制=%s | ε=%.4f | Δf(L1)=%.4f",
            mechanism.value, epsilon, l1_sensitivity,
        )

    def _clip_embeddings(self, embeddings: np.ndarray) -> np.ndarray:
        """
        可选的特征向量 L2 范数裁剪，用于在注入噪声前将敏感度控制在已知范围内。
        裁剪本身不提供隐私保护，仅辅助确保敏感度上限的准确性。
        """
        if self.clip_norm is None:
            return embeddings
        norm = np.linalg.norm(embeddings.flatten())
        if norm > self.clip_norm:
            return embeddings * (self.clip_norm / norm)
        return embeddings

    def apply_laplace_mechanism(self, embeddings: np.ndarray) -> np.ndarray:
        """
        拉普拉斯机制：M(x) = x + Lap(Δf / ε)

        此方法是满足 PDPA 不可逆匿名化标准的核心操作。

        Args:
            embeddings: 视觉特征向量（任意形状的 numpy 数组）

        Returns:
            加噪后的匿名化特征向量（与输入形状相同）
        """
        clipped = self._clip_embeddings(embeddings)

        # 拉普拉斯尺度参数：b = Δf / ε
        scale = self.l1_sensitivity / self.epsilon

        # 生成与特征向量同形的拉普拉斯随机噪声
        noise = np.random.laplace(loc=0.0, scale=scale, size=clipped.shape)

        anonymized = clipped + noise.astype(clipped.dtype)

        logger.debug(
            "LDP-Laplace 注入完成 | 特征形状=%s | 噪声尺度=%.6f | "
            "噪声均值=%.6f | 噪声标准差=%.6f",
            clipped.shape, scale, float(np.mean(noise)), float(np.std(noise)),
        )
        return anonymized

    def apply_gaussian_mechanism(self, embeddings: np.ndarray) -> np.ndarray:
        """
        高斯机制：M(x) = x + N(0, σ²)，提供 (ε, δ)-差分隐私。

        相比拉普拉斯机制，高斯机制在高维特征空间中能量损失更小，
        但需要额外的 δ 失败概率参数，适用于 δ > 0 可接受的场景。

        σ 计算公式（近似）：σ = Δ₂ × √(2 ln(1.25/δ)) / ε

        Args:
            embeddings: 视觉特征向量

        Returns:
            (ε, δ)-差分隐私保护的匿名化特征向量
        """
        clipped = self._clip_embeddings(embeddings)

        sigma = (
            self.l2_sensitivity
            * np.sqrt(2 * np.log(1.25 / self.delta))
            / self.epsilon
        )

        noise = np.random.normal(loc=0.0, scale=sigma, size=clipped.shape)
        anonymized = clipped + noise.astype(clipped.dtype)

        logger.debug(
            "LDP-Gaussian 注入完成 | σ=%.6f | ε=%.4f | δ=%.2e",
            sigma, self.epsilon, self.delta,
        )
        return anonymized

    def apply(self, embeddings: np.ndarray) -> np.ndarray:
        """
        根据配置的机制自动选择噪声注入方式。
        推荐通过此方法调用，便于切换机制。
        """
        if self.mechanism == NoiseMechanism.LAPLACE:
            return self.apply_laplace_mechanism(embeddings)
        elif self.mechanism == NoiseMechanism.GAUSSIAN:
            return self.apply_gaussian_mechanism(embeddings)
        else:
            raise NotImplementedError(f"不支持的噪声机制: {self.mechanism}")

    def estimate_privacy_loss(self, num_queries: int) -> float:
        """
        估算多次查询后的累积隐私损失（基础组合定理）。

        Args:
            num_queries: 查询次数

        Returns:
            累积 ε 值（基础组合：ε_total = num_queries × ε_per_query）
        """
        total_epsilon = num_queries * self.epsilon
        logger.info(
            "累积隐私损失估算 | 查询次数=%d | ε_per_query=%.4f | ε_total=%.4f",
            num_queries, self.epsilon, total_epsilon,
        )
        return total_epsilon
