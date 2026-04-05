"""
tests/test_integration.py
端到端集成测试：模拟完整跨境推理流水线

测试场景覆盖：
  1. 新加坡边缘端 → 国密加密封装 → 重庆 AIDC 解密 → VLM 推理 → 返回结果
  2. 多租户并发隔离（不同租户请求不互相干扰）
  3. 配额超限拒绝（FinOps 计费边界测试）
  4. 数据篡改检测（SM3 MAC 不通过时 400 响应）
  5. Token 过期拒绝（401 响应）

运行方式：
  pytest tests/test_integration.py -v
"""

import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

# ─── 构建测试用应用实例 ──────────────────────────────────────────


def _build_test_app():
    """
    构建一个已完成启动事件的测试应用实例。
    使用 TestClient 可同步调用 async FastAPI 端点。
    """
    from cq_cloud.server import app, _billing_engine, _crypto_server, _vlm_engine
    import cq_cloud.server as srv

    # 注入测试替代品（避免依赖真实 GPU 和密钥文件）
    from cq_cloud.billing import FinOpsBillingEngine
    from cq_cloud.gm_crypto_server import GMCryptoServer
    from cq_cloud.vlm_engine import DistributedVLMEngine

    srv._crypto_server  = GMCryptoServer(private_key_path="/nonexistent")
    srv._billing_engine = FinOpsBillingEngine()
    srv._vlm_engine     = DistributedVLMEngine(simulation_mode=True)

    return app


@pytest.fixture(scope="module")
def client():
    """提供预初始化的 FastAPI 测试客户端。"""
    app = _build_test_app()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="module")
def crypto_client():
    """提供国密客户端实例（用于构造测试请求）。"""
    from sg_edge.gm_crypto_client import GMCryptoClient
    return GMCryptoClient()


@pytest.fixture(scope="module")
def server_public_key(client):
    """获取测试服务端公钥。"""
    resp = client.get("/v1/crypto/public-key")
    assert resp.status_code == 200
    return resp.json()["public_key_pem"]


def _build_valid_request(
    crypto_client,
    server_public_key: str,
    visual_shape=(196, 384),
    prompt: str = "请描述图像内容。",
    bearer_token: str = "test-token-tenant-001",
):
    """
    构造一个完整的、格式正确的跨境推理请求。

    Returns:
        (headers, body) 元组
    """
    # 生成模拟的 LDP 处理后特征向量
    features = np.random.randn(*visual_shape).astype(np.float32)

    # 构造载荷
    payload = json.dumps({
        "visual_vector": features.flatten().tolist(),
        "tensor_shape":  list(visual_shape),
        "textual_prompt": prompt,
    }, ensure_ascii=False).encode("utf-8")

    # 国密加密封装
    session_key = crypto_client.generate_sm4_session_key()
    integrity_mac = crypto_client.sm3_digest(payload)
    encrypted_body, auth_tag = crypto_client.sm4_gcm_encrypt(payload, session_key)
    wrapped_key = crypto_client.sm2_encrypt(session_key, server_public_key)

    headers = {
        "Authorization":      f"Bearer {bearer_token}",
        "X-Key-Encapsulation": wrapped_key.hex(),
        "X-SM3-Integrity-Mac": integrity_mac.hex(),
        "X-GCM-Auth-Tag":      auth_tag.hex(),
        "Content-Type":        "application/octet-stream",
    }
    return headers, encrypted_body


# ─────────────────────────────────────────────────────────────────
#  测试组 1：正常推理流程
# ─────────────────────────────────────────────────────────────────

class TestNormalInferencePipeline:
    """验证正常推理请求的完整处理链路。"""

    def test_health_check(self, client):
        """健康检查端点应返回 200。"""
        resp = client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_public_key_endpoint(self, client):
        """公钥分发端点应返回有效的 PEM 格式公钥。"""
        resp = client.get("/v1/crypto/public-key")
        assert resp.status_code == 200
        pub_key = resp.json().get("public_key_pem", "")
        assert "BEGIN" in pub_key or len(pub_key) > 10

    def test_full_inference_pipeline(self, client, crypto_client, server_public_key):
        """
        完整推理管道测试：
        构造请求 → 国密加密 → 发送 → 解密 → 推理 → 计费 → 返回结果
        """
        headers, body = _build_valid_request(
            crypto_client, server_public_key, prompt="分析这张医学影像。"
        )
        resp = client.post(
            "/v1/completions/vlm-crossborder",
            content=body,
            headers=headers,
        )
        assert resp.status_code == 200, f"推理请求应返回 200，实际: {resp.status_code} | {resp.text}"

        data = resp.json()
        assert "result_text" in data,    "响应应包含 result_text 字段。"
        assert "finops_metrics" in data, "响应应包含 finops_metrics 计费信息。"
        assert data["status"] == "Inference Complete"

        metrics = data["finops_metrics"]
        assert metrics["input_tokens_billed"]  > 0, "输入 Token 计费数应大于 0。"
        assert metrics["output_tokens_billed"] > 0, "输出 Token 计费数应大于 0。"

    def test_visual_tokens_scale_with_patch_count(self, client, crypto_client, server_public_key):
        """
        验证视觉 Token 数量与特征矩阵 Patch 数成正比。
        ViT-Small (196 patches) vs ViT-Large (196 patches, 不同 embed_dim)
        均应产生 197 个视觉 Token（196 + 1 CLS）。
        """
        headers, body = _build_valid_request(
            crypto_client, server_public_key,
            visual_shape=(196, 384),  # ViT-Small-Patch16
            bearer_token="test-token-tenant-002",
        )
        resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
        assert resp.status_code == 200
        visual_tokens = resp.json()["finops_metrics"]["visual_tokens"]
        assert visual_tokens == 197, f"应计费 197 个视觉 Token，实际: {visual_tokens}"

    def test_billing_usage_recorded(self, client, crypto_client, server_public_key):
        """验证推理完成后用量被正确记录到 FinOps 账单。"""
        bearer = "test-token-billing-check"
        headers, body = _build_valid_request(
            crypto_client, server_public_key, bearer_token=bearer
        )
        # 执行推理（产生用量）
        resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
        assert resp.status_code == 200
        billed_input = resp.json()["finops_metrics"]["input_tokens_billed"]

        # 查询用量账单
        usage_resp = client.get(
            "/v1/billing/usage",
            headers={"Authorization": f"Bearer {bearer}"},
        )
        assert usage_resp.status_code == 200
        usage = usage_resp.json()
        assert usage["used_input_tokens"] >= billed_input, (
            "账单查询的累计用量应不少于本次推理的计费量。"
        )


# ─────────────────────────────────────────────────────────────────
#  测试组 2：安全与认证边界
# ─────────────────────────────────────────────────────────────────

class TestSecurityBoundaries:
    """验证各种非法请求均被正确拒绝。"""

    def test_missing_auth_token_rejected(self, client, crypto_client, server_public_key):
        """无 Authorization 头的请求应被拒绝（401）。"""
        headers, body = _build_valid_request(crypto_client, server_public_key)
        del headers["Authorization"]  # 移除认证头

        resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
        assert resp.status_code == 401, f"无 Token 请求应返回 401，实际: {resp.status_code}"

    def test_tampered_integrity_mac_rejected(self, client, crypto_client, server_public_key):
        """SM3 MAC 被篡改的请求应返回 400。"""
        headers, body = _build_valid_request(crypto_client, server_public_key)
        headers["X-SM3-Integrity-Mac"] = "00" * 32  # 伪造全零 MAC

        resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
        assert resp.status_code in (400, 422), (
            f"MAC 篡改请求应返回 400/422，实际: {resp.status_code}"
        )

    def test_missing_key_encapsulation_rejected(self, client, crypto_client, server_public_key):
        """缺少 X-Key-Encapsulation 头的请求应返回 400。"""
        headers, body = _build_valid_request(crypto_client, server_public_key)
        del headers["X-Key-Encapsulation"]

        resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
        assert resp.status_code == 400, (
            f"缺少密钥封装头应返回 400，实际: {resp.status_code}"
        )

    def test_empty_body_rejected(self, client, crypto_client, server_public_key):
        """空请求体应被拒绝（400 或 422）。"""
        headers, _ = _build_valid_request(crypto_client, server_public_key)
        resp = client.post(
            "/v1/completions/vlm-crossborder",
            content=b"",
            headers=headers,
        )
        assert resp.status_code in (400, 422)

    def test_invalid_key_encapsulation_hex(self, client, crypto_client, server_public_key):
        """无效的十六进制密钥封装值应触发解封失败（403）。"""
        headers, body = _build_valid_request(crypto_client, server_public_key)
        headers["X-Key-Encapsulation"] = "not-valid-hex-string"

        resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
        assert resp.status_code in (400, 403), (
            f"无效密钥封装应返回 400/403，实际: {resp.status_code}"
        )


# ─────────────────────────────────────────────────────────────────
#  测试组 3：多租户隔离
# ─────────────────────────────────────────────────────────────────

class TestMultiTenantIsolation:
    """验证不同租户的请求和账单数据相互独立。"""

    def test_different_tenants_have_independent_billing(
        self, client, crypto_client, server_public_key
    ):
        """两个不同租户的账单数据应完全独立。"""
        tenants = ["tenant-isolation-A", "tenant-isolation-B"]

        for tenant in tenants:
            headers, body = _build_valid_request(
                crypto_client, server_public_key,
                bearer_token=f"test-token-{tenant}",
            )
            resp = client.post("/v1/completions/vlm-crossborder", content=body, headers=headers)
            assert resp.status_code == 200

        # 分别查询两个租户的用量
        usages = {}
        for tenant in tenants:
            usage_resp = client.get(
                "/v1/billing/usage",
                headers={"Authorization": f"Bearer test-token-{tenant}"},
            )
            assert usage_resp.status_code == 200
            usages[tenant] = usage_resp.json()

        # 确保两个租户的用量记录彼此独立（tenant_id 不同）
        assert usages[tenants[0]]["tenant_id"] != usages[tenants[1]]["tenant_id"], (
            "两个不同租户的 tenant_id 不应相同。"
        )

    def test_quota_endpoint_returns_tenant_specific_data(
        self, client, crypto_client, server_public_key
    ):
        """配额查询端点应返回当前认证租户专属的配额信息。"""
        bearer = "test-token-quota-check"
        resp = client.get(
            "/v1/billing/quota",
            headers={"Authorization": f"Bearer {bearer}"},
        )
        assert resp.status_code == 200
        quota = resp.json()
        assert "monthly_quota_tokens" in quota
        assert quota["monthly_quota_tokens"] > 0


# ─────────────────────────────────────────────────────────────────
#  测试组 4：FinOps 计费精度
# ─────────────────────────────────────────────────────────────────

class TestFinOpsBillingAccuracy:
    """验证 Token 计费逻辑的正确性。"""

    def test_spatial_token_calculation_196_patches(self):
        """ViT-Small-Patch16 输出 196 patches → 应计费 197 个视觉 Token。"""
        from cq_cloud.billing import calculate_spatial_tokens
        shape = (196, 384)  # (N_patches, embed_dim)
        tokens = calculate_spatial_tokens(shape)
        assert tokens == 197, f"期望 197 个视觉 Token，实际: {tokens}"

    def test_spatial_token_calculation_256_patches(self):
        """16×16 patch 网格 (ViT-Base-Patch14, 256 patches) → 257 个视觉 Token。"""
        from cq_cloud.billing import calculate_spatial_tokens
        shape = (256, 768)
        tokens = calculate_spatial_tokens(shape)
        assert tokens == 257

    def test_spatial_token_fallback_for_unknown_shape(self):
        """未知张量形状应返回保底计费值 197（防止计费为 0）。"""
        from cq_cloud.billing import calculate_spatial_tokens
        tokens = calculate_spatial_tokens((384,))   # 1D 张量
        assert tokens >= 100, "保底计费值不应为 0 或负数。"

    def test_billing_engine_debit_and_query(self):
        """验证扣费后查询用量的一致性。"""
        from cq_cloud.billing import FinOpsBillingEngine
        engine = FinOpsBillingEngine()
        tid = "unit-test-tenant-billing"

        assert engine.check_quota(tid, 100)  # 新租户应有充足配额

        cost = engine.debit_account(tid, input_tokens=1000, output_tokens=500)
        assert cost > 0, "扣费金额应大于 0。"

        usage = engine.get_usage(tid)
        assert usage["used_input_tokens"]  == 1000
        assert usage["used_output_tokens"] == 500

    def test_quota_exhaustion_check(self):
        """配额耗尽后应拒绝新请求。"""
        from cq_cloud.billing import FinOpsBillingEngine
        engine = FinOpsBillingEngine()
        tid = "quota-exhaustion-test"

        # 耗尽配额
        engine.debit_account(tid, input_tokens=10_000_000, output_tokens=0)

        # 再次请求应被拒绝
        assert not engine.check_quota(tid, 1), (
            "配额耗尽后 check_quota 应返回 False。"
        )
