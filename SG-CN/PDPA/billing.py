"""
cq_cloud/billing.py
FinOps 多租户 Token 计费引擎

实现基于"视觉 Patch 空间映射 + 文本 BPE"的细粒度多模态计费模型。

计费逻辑：
  输入成本 = 视觉 Patch Token × 视觉单价 + 文本 Token × 文本单价
  输出成本 = 生成文本 Token × 输出单价

视觉 Patch Token 映射原理：
  当边缘端使用 ViT-Small-Patch16（image_size=224, patch_size=16）时：
  N_patches = (224/16)² = 196 个空间 Patch
  加上 [CLS] token = 197 个视觉 Token

价格体系（示例，参考国际主流 VLM API 定价，单位：人民币/百万 Token）：
  视觉输入：6 元/MTok（约为 GPT-4o Vision 价格的 1/5）
  文本输入：4 元/MTok
  文本输出：16 元/MTok
"""

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# 默认价格（单位：元/百万 Token）
DEFAULT_PRICE_VISUAL_INPUT  = 6.0
DEFAULT_PRICE_TEXT_INPUT    = 4.0
DEFAULT_PRICE_TEXT_OUTPUT   = 16.0

# 默认租户月度配额（单位：Token）
DEFAULT_MONTHLY_QUOTA = 10_000_000  # 1000 万 Token


def calculate_spatial_tokens(tensor_shape: Tuple) -> int:
    """
    多模态计费转换器：将特征张量的空间维度映射为等效视觉 Token 数量。

    支持的张量形状：
      - (N_patches, embed_dim)：标准 ViT 输出
      - (batch, N_patches, embed_dim)：批量处理输出（取第一个样本）
      - 其他形状：返回默认保底值

    Args:
        tensor_shape: 特征张量的形状元组

    Returns:
        等效视觉 Token 数量
    """
    if len(tensor_shape) >= 2:
        n_patches = int(tensor_shape[-2])  # 倒数第二维为 Patch 数
        # 加 1 为 [CLS] token
        visual_tokens = n_patches + 1
        logger.debug("视觉 Token 计算 | 张量形状=%s | 视觉Token=%d", tensor_shape, visual_tokens)
        return visual_tokens
    elif len(tensor_shape) >= 3:
        num_x = int(tensor_shape[-3])
        num_y = int(tensor_shape[-2])
        return int(num_x * num_y) + 1

    logger.warning("无法从张量形状 %s 计算视觉 Token，返回保底值 197。", tensor_shape)
    return 197  # ViT-Small-Patch16 默认值


@dataclass
class TenantAccount:
    """租户账户状态。"""
    tenant_id: str
    plan_tier: str = "standard"
    monthly_quota_tokens: int = DEFAULT_MONTHLY_QUOTA
    used_input_tokens: int = 0
    used_output_tokens: int = 0
    accumulated_cost_cny: float = 0.0
    quota_reset_timestamp: float = field(default_factory=lambda: time.time() + 30*86400)


class FinOpsBillingEngine:
    """
    FinOps 多租户 Token 计费引擎。

    线程安全的内存计费实现（生产环境建议替换为 Redis 或 PostgreSQL 后端）。
    """

    def __init__(
        self,
        price_visual_input: float = DEFAULT_PRICE_VISUAL_INPUT,
        price_text_input: float = DEFAULT_PRICE_TEXT_INPUT,
        price_text_output: float = DEFAULT_PRICE_TEXT_OUTPUT,
    ):
        self._price_visual = price_visual_input   # 元/MTok
        self._price_text_in = price_text_input
        self._price_text_out = price_text_output
        self._accounts: Dict[str, TenantAccount] = {}
        self._lock = threading.Lock()
        logger.info("FinOps 计费引擎初始化完成。")

    def _get_or_create_account(self, tenant_id: str) -> TenantAccount:
        if tenant_id not in self._accounts:
            self._accounts[tenant_id] = TenantAccount(tenant_id=tenant_id)
            logger.info("创建新租户账户: %s", tenant_id)
        return self._accounts[tenant_id]

    def check_quota(self, tenant_id: str, estimated_input_tokens: int) -> bool:
        """检查租户是否有足够的 Token 配额执行本次请求。"""
        with self._lock:
            account = self._get_or_create_account(tenant_id)
            remaining = account.monthly_quota_tokens - account.used_input_tokens
            if estimated_input_tokens > remaining:
                logger.warning(
                    "租户 %s 配额不足 | 剩余=%d | 本次需要=%d",
                    tenant_id, remaining, estimated_input_tokens,
                )
                return False
            return True

    def debit_account(
        self,
        tenant_id: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """
        扣减租户账户 Token 用量并计算费用。

        Args:
            tenant_id:     租户 ID
            input_tokens:  本次请求消耗的输入 Token（视觉 + 文本）
            output_tokens: 本次生成的输出 Token

        Returns:
            本次请求的费用（元）
        """
        with self._lock:
            account = self._get_or_create_account(tenant_id)
            account.used_input_tokens  += input_tokens
            account.used_output_tokens += output_tokens

            # 简化：视觉和文本输入统一按文本输入价格计费（实际可分开记录）
            cost = (
                input_tokens  / 1_000_000 * self._price_text_in +
                output_tokens / 1_000_000 * self._price_text_out
            )
            account.accumulated_cost_cny += cost

            logger.debug(
                "计费记录 | 租户=%s | 输入+=%d | 输出+=%d | 费用=¥%.6f | 累计=¥%.4f",
                tenant_id, input_tokens, output_tokens,
                cost, account.accumulated_cost_cny,
            )
            return cost

    def get_usage(self, tenant_id: str) -> Dict[str, Any]:
        """获取租户用量报告。"""
        with self._lock:
            account = self._get_or_create_account(tenant_id)
            return {
                "tenant_id": account.tenant_id,
                "used_input_tokens": account.used_input_tokens,
                "used_output_tokens": account.used_output_tokens,
                "accumulated_cost_cny": round(account.accumulated_cost_cny, 4),
                "monthly_quota_tokens": account.monthly_quota_tokens,
                "remaining_quota": account.monthly_quota_tokens - account.used_input_tokens,
            }

    def get_quota(self, tenant_id: str) -> Dict[str, Any]:
        """获取租户配额信息。"""
        with self._lock:
            account = self._get_or_create_account(tenant_id)
            return {
                "tenant_id": account.tenant_id,
                "plan_tier": account.plan_tier,
                "monthly_quota_tokens": account.monthly_quota_tokens,
                "quota_reset_at": account.quota_reset_timestamp,
            }
