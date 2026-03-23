"""
cq_cloud/auth.py
零信任多租户身份验证模块（OIDC / OAuth 2.0）

实现基于 Bearer Token 的无状态身份验证，支持 OIDC ID Token 和
自定义 JWT 格式。网关在每个请求上独立验证身份，不依赖会话状态（零信任原则）。
"""

import logging
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# OIDC 配置（生产环境从环境变量读取）
OIDC_ISSUER = "https://auth.sg-cq-api.example.com"
OIDC_AUDIENCE = "cq-aidc-vlm-api"


@dataclass
class TenantIdentity:
    """经验证的租户身份信息。"""
    tenant_id: str
    plan_tier: str        # 套餐层级：free | standard | enterprise
    rate_limit_rpm: int   # 每分钟请求限制


async def verify_bearer_token(request: Request) -> TenantIdentity:
    """
    FastAPI 依赖项：从请求头提取并验证 Bearer Token。

    生产环境实现：
      1. 解析 Authorization: Bearer <token>
      2. 调用 OIDC Provider 的 /userinfo 端点或本地 JWKS 验证签名
      3. 提取 claims 中的 tenant_id 和 plan_tier

    当前为开发模式简化实现。
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少或格式无效的 Authorization 头。")

    token = auth_header[len("Bearer "):]

    if not token:
        raise HTTPException(status_code=401, detail="Bearer Token 为空。")

    # 开发模式：直接解析 token 前缀作为 tenant_id（生产环境替换为 JWKS 验证）
    try:
        identity = _validate_token_dev(token)
        logger.debug("身份验证成功 | 租户=%s | 套餐=%s", identity.tenant_id, identity.plan_tier)
        return identity
    except Exception as exc:
        logger.warning("Token 验证失败: %s", exc)
        raise HTTPException(status_code=401, detail="Token 验证失败，请重新获取。")


def _validate_token_dev(token: str) -> TenantIdentity:
    """
    开发模式 Token 验证（非生产环境）。
    生产环境替换为：python-jose 或 authlib 的 JWKS 验证逻辑。
    """
    # 模拟：提取 JWT payload（实际应使用 jwt.decode 并验证签名）
    parts = token.split(".")
    if len(parts) == 3:
        import base64, json
        payload_b64 = parts[1] + "=="  # 补充 padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        tenant_id = payload.get("sub", "dev-tenant-001")
        plan_tier = payload.get("plan_tier", "standard")
    else:
        # 非 JWT 格式：直接使用 token 作为 tenant_id
        tenant_id = f"tenant-{token[:16]}"
        plan_tier = "standard"

    return TenantIdentity(
        tenant_id=tenant_id,
        plan_tier=plan_tier,
        rate_limit_rpm={"free": 10, "standard": 100, "enterprise": 1000}.get(plan_tier, 100),
    )
