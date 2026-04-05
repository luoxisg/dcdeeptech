"""
cq_cloud/server.py
重庆 AIDC 算力节点：云端接收与推理网关

职责：
  1. 零信任身份验证（OIDC/OAuth 2.0 Bearer Token）
  2. SM2 私钥解封会话密钥（KEM 解封装）
  3. SM4-GCM 载荷解密 + SM3 完整性二次校验
  4. 多租户内存隔离与 vLLM 连续批处理调度
  5. 多模态特征向量 → 大模型推理执行
  6. FinOps Token 计费（视觉 Patch 映射 + 文本 BPE 计量）
  7. 推理结果国密加密后返回

合规架构说明：
  - 本服务接收的所有入站数据均为经 ε-LDP 处理的匿名化特征向量
  - 不存储、不记录任何可能关联到新加坡原始用户的视觉信息
  - 完全符合中国数据安全法及国密合规要求
"""

import json
import logging
from typing import Any, Dict

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from cq_cloud.auth import TenantIdentity, verify_bearer_token
from cq_cloud.billing import FinOpsBillingEngine, calculate_spatial_tokens
from cq_cloud.gm_crypto_server import GMCryptoServer
from cq_cloud.vlm_engine import DistributedVLMEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
#  应用初始化（GPU 集群启动时预热，避免首请求冷启动延迟）
# ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Chongqing AIDC — Token Export Gateway",
    description=(
        "基于中新专用数据通道的 PDPA 合规 VLM 跨境推理 API。"
        "仅接受经 ε-差分隐私处理的匿名化视觉特征向量，不处理原始像素数据。"
    ),
    version="1.0.0",
)

# 全局单例（服务启动时初始化）
_vlm_engine: DistributedVLMEngine | None = None
_billing_engine: FinOpsBillingEngine | None = None
_crypto_server: GMCryptoServer | None = None


@app.on_event("startup")
async def startup_event() -> None:
    """服务启动时初始化 GPU 推理集群、计费引擎和国密服务。"""
    global _vlm_engine, _billing_engine, _crypto_server

    logger.info("正在初始化重庆 AIDC 推理网关...")

    _crypto_server = GMCryptoServer(
        private_key_path="/opt/security/keys/aidc_private.pem"
    )
    _billing_engine = FinOpsBillingEngine()
    _vlm_engine = DistributedVLMEngine(
        model_path="/mnt/models/vlm-72b-instruct",
        tensor_parallel_size=8,  # 根据 H20/A100 集群规模调整
    )

    logger.info("AIDC 推理网关初始化完成，等待来自新加坡的请求...")


# ─────────────────────────────────────────────────────────────────
#  公钥分发端点（供客户端拉取 SM2 公钥）
# ─────────────────────────────────────────────────────────────────

@app.get("/v1/crypto/public-key")
async def get_server_public_key() -> JSONResponse:
    """
    返回服务端 SM2 公钥（PEM 格式）。
    客户端使用此公钥包裹 SM4 会话密钥（KEM 机制）。
    """
    if _crypto_server is None:
        raise HTTPException(status_code=503, detail="加密服务未就绪。")
    return JSONResponse({"public_key_pem": _crypto_server.get_public_key_pem()})


# ─────────────────────────────────────────────────────────────────
#  主推理端点
# ─────────────────────────────────────────────────────────────────

@app.post("/v1/completions/vlm-crossborder")
async def execute_crossborder_inference(
    request: Request,
    tenant: TenantIdentity = Depends(verify_bearer_token),
) -> JSONResponse:
    """
    处理来自新加坡边缘节点的跨境推理请求。

    请求头（Headers）：
      Authorization:      Bearer <OIDC_TOKEN>
      X-Key-Encapsulation: <SM2 包裹的 SM4 会话密钥（十六进制）>
      X-SM3-Integrity-Mac: <SM3 消息认证码（十六进制）>
      X-GCM-Auth-Tag:     <SM4-GCM 认证标签（十六进制）>

    请求体（Body）：
      SM4-GCM 加密的 JSON 载荷（application/octet-stream）
      解密后格式：
      {
        "visual_vector": [...],      # ε-LDP 处理后的扁平特征向量
        "tensor_shape":  [N, D],     # 原始特征矩阵形状
        "textual_prompt": "..."      # 推理任务文本指令
      }

    返回：
      {
        "status":       "Inference Complete",
        "result_text":  "...",       # 推理生成的纯文本
        "finops_metrics": {
          "input_tokens_billed":  N,
          "output_tokens_billed": M
        }
      }
    """
    if _crypto_server is None or _vlm_engine is None or _billing_engine is None:
        raise HTTPException(status_code=503, detail="推理服务未就绪，请稍后重试。")

    # ── 步骤 2：解封会话密钥 ──────────────────────────────────────
    wrapped_key_hex = request.headers.get("X-Key-Encapsulation", "")
    if not wrapped_key_hex:
        raise HTTPException(status_code=400, detail="缺少 X-Key-Encapsulation 请求头。")

    try:
        session_key = _crypto_server.sm2_decrypt(bytes.fromhex(wrapped_key_hex))
    except Exception as exc:
        logger.warning("SM2 密钥解封失败（可能的入侵尝试）: %s", exc)
        raise HTTPException(status_code=403, detail="密钥解封失败，拒绝访问。")

    # ── 步骤 3：SM4-GCM 解密载荷 ─────────────────────────────────
    encrypted_payload = await request.body()
    auth_tag_hex = request.headers.get("X-GCM-Auth-Tag", "")

    if not encrypted_payload or not auth_tag_hex:
        raise HTTPException(status_code=400, detail="请求体或 X-GCM-Auth-Tag 为空。")

    try:
        decrypted_bytes = _crypto_server.sm4_gcm_decrypt(
            ciphertext_with_iv=encrypted_payload,
            key=session_key,
            auth_tag=bytes.fromhex(auth_tag_hex),
        )
    except Exception as exc:
        logger.warning("SM4-GCM 解密失败（MAC 验证可能不通过）: %s", exc)
        raise HTTPException(status_code=400, detail="载荷解密或 MAC 验证失败。")

    # ── 步骤 4：SM3 完整性二次校验 ────────────────────────────────
    integrity_mac_hex = request.headers.get("X-SM3-Integrity-Mac", "")
    if integrity_mac_hex:
        computed_mac = _crypto_server.sm3_digest(decrypted_bytes)
        if computed_mac.hex() != integrity_mac_hex:
            logger.error(
                "SM3 完整性校验失败！租户=%s | 预期=%s | 实际=%s",
                tenant.tenant_id, integrity_mac_hex, computed_mac.hex(),
            )
            raise HTTPException(status_code=400, detail="传输过程中数据完整性被破坏。")

    # ── 步骤 5：重建特征张量 ──────────────────────────────────────
    try:
        payload: Dict[str, Any] = json.loads(decrypted_bytes.decode("utf-8"))
        visual_tensor = np.array(payload["visual_vector"], dtype=np.float32).reshape(
            payload["tensor_shape"]
        )
        prompt_text = payload["textual_prompt"]
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"载荷格式无效: {exc}")

    logger.info(
        "收到推理请求 | 租户=%s | 特征形状=%s | 指令长度=%d字符",
        tenant.tenant_id, visual_tensor.shape, len(prompt_text),
    )

    # ── 步骤 6：FinOps Token 计量 ─────────────────────────────────
    visual_tokens = calculate_spatial_tokens(visual_tensor.shape)
    text_input_tokens = _vlm_engine.count_tokens(prompt_text)
    total_input_tokens = visual_tokens + text_input_tokens

    # 检查租户配额
    if not _billing_engine.check_quota(tenant.tenant_id, total_input_tokens):
        raise HTTPException(
            status_code=429,
            detail=f"租户 {tenant.tenant_id} Token 配额不足，请充值或升级套餐。",
        )

    # ── 步骤 7：投递至 vLLM 连续批处理执行推理 ────────────────────
    try:
        generated_text, output_token_count = _vlm_engine.generate_from_embeddings(
            visual_features=visual_tensor,
            text_instruction=prompt_text,
            max_new_tokens=1024,
        )
    except Exception as exc:
        logger.error("VLM 推理执行失败: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="推理执行失败，请稍后重试。")

    # ── 步骤 8：扣减计费账单 ──────────────────────────────────────
    _billing_engine.debit_account(
        tenant_id=tenant.tenant_id,
        input_tokens=total_input_tokens,
        output_tokens=output_token_count,
    )

    logger.info(
        "推理完成 | 租户=%s | 输入Token=%d（视觉%d+文本%d）| 输出Token=%d",
        tenant.tenant_id, total_input_tokens,
        visual_tokens, text_input_tokens, output_token_count,
    )

    return JSONResponse({
        "status": "Inference Complete",
        "result_text": generated_text,
        "finops_metrics": {
            "input_tokens_billed": total_input_tokens,
            "visual_tokens": visual_tokens,
            "text_input_tokens": text_input_tokens,
            "output_tokens_billed": output_token_count,
        },
    })


# ─────────────────────────────────────────────────────────────────
#  计费查询端点
# ─────────────────────────────────────────────────────────────────

@app.get("/v1/billing/usage")
async def get_usage(tenant: TenantIdentity = Depends(verify_bearer_token)) -> JSONResponse:
    """查询当前计费周期的 Token 用量。"""
    if _billing_engine is None:
        raise HTTPException(status_code=503, detail="计费服务未就绪。")
    usage = _billing_engine.get_usage(tenant.tenant_id)
    return JSONResponse(usage)


@app.get("/v1/billing/quota")
async def get_quota(tenant: TenantIdentity = Depends(verify_bearer_token)) -> JSONResponse:
    """查询租户配额上限。"""
    if _billing_engine is None:
        raise HTTPException(status_code=503, detail="计费服务未就绪。")
    quota = _billing_engine.get_quota(tenant.tenant_id)
    return JSONResponse(quota)


@app.get("/healthz")
async def health_check() -> JSONResponse:
    """健康检查端点，供负载均衡器使用。"""
    return JSONResponse({"status": "ok", "service": "cq-aidc-vlm-gateway"})
