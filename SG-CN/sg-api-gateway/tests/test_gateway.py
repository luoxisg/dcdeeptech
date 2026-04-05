"""
完整测试套件
覆盖：PDPA过滤、鉴权、限流、链路转发、健康检查
"""
from __future__ import annotations

import hashlib
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient

# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def test_settings(monkeypatch=None):
    """覆盖测试用配置"""
    import os
    os.environ.update({
        "ENVIRONMENT": "development",
        "DEBUG": "true",
        "REDIS_URL": "redis://localhost:6379/15",
        "ADMIN_API_KEY": "test_admin_key_for_unit_tests_only",
        "CQ_BACKEND_PRIMARY": "http://mock-cq-primary:8080",
        "CQ_BACKEND_STANDBY": "http://mock-cq-standby:8080",
        "LOG_FORMAT": "console",
        "LOG_FILE": "",
        "AUDIT_LOG_FILE": "",
    })


@pytest.fixture
def app(test_settings):
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.main import create_app
    return create_app()


@pytest.fixture
def client(app):
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest_asyncio.fixture
async def async_client(app):
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ─────────────────────────────────────────────────────────────
# PDPA 字段过滤测试
# ─────────────────────────────────────────────────────────────

class TestPDPAFilter:
    """PDPA 字段过滤核心逻辑测试"""

    def setup_method(self):
        from app.services.pdpa_filter import PDPAFilter
        self.filter = PDPAFilter()

    def test_blocks_nric_field(self):
        payload = {"nric": "S1234567A", "query": "Hello"}
        result = self.filter.filter(payload, request_id="test-001", tenant_id="tenant1")
        assert "nric" not in result.clean_payload
        assert "query" in result.clean_payload
        assert any("nric" in f for f in result.blocked_fields)

    def test_blocks_multiple_sensitive_fields(self):
        payload = {
            "nric": "S1234567A",
            "email": "user@example.com",
            "phone": "81234567",
            "password": "secret123",
            "model": "gpt-4",
            "prompt": "Summarize this",
        }
        result = self.filter.filter(payload)
        assert "nric" not in result.clean_payload
        assert "email" not in result.clean_payload
        assert "phone" not in result.clean_payload
        assert "password" not in result.clean_payload
        assert result.clean_payload["model"] == "gpt-4"
        assert result.clean_payload["prompt"] == "Summarize this"

    def test_nested_dict_filtering(self):
        payload = {
            "user": {
                "nric": "S1234567A",
                "role": "admin",
            },
            "request": "summarize",
        }
        result = self.filter.filter(payload)
        # 顶层 clean_payload 有 user 和 request
        assert "request" in result.clean_payload
        # nric 被屏蔽
        assert any("nric" in f for f in result.blocked_fields)

    def test_safe_payload_passes_through(self):
        payload = {
            "model": "llama3",
            "messages": [{"role": "user", "content": "Hello"}],
            "temperature": 0.7,
            "max_tokens": 512,
        }
        result = self.filter.filter(payload)
        assert len(result.blocked_fields) == 0
        assert result.clean_payload["model"] == "llama3"
        assert result.clean_payload["temperature"] == 0.7

    def test_tenant_custom_blocked_fields(self):
        from app.services.pdpa_filter import PDPAFilter
        f = PDPAFilter(tenant_blocked_fields=["custom_field", "internal_id"])
        payload = {"custom_field": "abc", "model": "test"}
        result = f.filter(payload)
        assert "custom_field" not in result.clean_payload
        assert "model" in result.clean_payload

    def test_case_insensitive_blocking(self):
        payload = {"NRIC": "S1234567A", "Email": "user@test.com"}
        result = self.filter.filter(payload)
        assert "NRIC" not in result.clean_payload
        assert "Email" not in result.clean_payload

    def test_empty_payload(self):
        result = self.filter.filter({})
        assert result.clean_payload == {}
        assert result.blocked_fields == []

    def test_compliance_summary(self):
        summary = self.filter.get_compliance_summary()
        assert "global_blocked_fields" in summary
        assert "nric" in summary["global_blocked_fields"]
        assert summary["policy"] == "minimum_necessary"


# ─────────────────────────────────────────────────────────────
# API Key 鉴权测试
# ─────────────────────────────────────────────────────────────

class TestAPIKeyAuth:
    """API Key 鉴权模块测试"""

    def test_generate_api_key_format(self):
        from app.core.auth import generate_api_key
        key = generate_api_key(prefix="sgk-test")
        assert key.startswith("sgk-test_")
        assert len(key) >= 32

    def test_generate_unique_keys(self):
        from app.core.auth import generate_api_key
        keys = {generate_api_key() for _ in range(100)}
        assert len(keys) == 100  # 全部唯一

    @pytest.mark.asyncio
    async def test_store_and_retrieve_key(self):
        from app.core.auth import APIKeyStore
        from app.models.tenant import APIKeyRecord
        
        raw_key = "test_key_for_store_retrieve_12345"
        record = APIKeyRecord(tenant_id="t1", project_id="p1", scope="write")
        
        await APIKeyStore.store_record(raw_key, record)
        retrieved = await APIKeyStore.get_record(raw_key)
        
        assert retrieved is not None
        assert retrieved.tenant_id == "t1"
        assert retrieved.project_id == "p1"

    @pytest.mark.asyncio
    async def test_revoke_key(self):
        from app.core.auth import APIKeyStore
        from app.models.tenant import APIKeyRecord
        
        raw_key = "test_key_for_revoke_12345678901"
        record = APIKeyRecord(tenant_id="t2", project_id="p2")
        await APIKeyStore.store_record(raw_key, record)
        
        revoked = await APIKeyStore.revoke_key(raw_key)
        assert revoked is True
        
        retrieved = await APIKeyStore.get_record(raw_key)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_unknown_key_returns_none(self):
        from app.core.auth import APIKeyStore
        result = await APIKeyStore.get_record("nonexistent_key_that_doesnt_exist")
        assert result is None

    def test_key_hash_is_deterministic(self):
        from app.core.auth import APIKeyStore
        key = "my_test_key_abc123"
        h1 = APIKeyStore._hash_key(key)
        h2 = APIKeyStore._hash_key(key)
        assert h1 == h2
        assert h1 == hashlib.sha256(key.encode()).hexdigest()

    def test_safe_compare_prevents_timing_attack(self):
        from app.core.auth import APIKeyStore
        key = "safe_compare_test_key_xxxxx"
        h = APIKeyStore._hash_key(key)
        assert APIKeyStore._safe_compare(key, h) is True
        assert APIKeyStore._safe_compare("wrong_key", h) is False


# ─────────────────────────────────────────────────────────────
# 熔断器测试
# ─────────────────────────────────────────────────────────────

class TestCircuitBreaker:
    """熔断器状态机测试"""

    @pytest.mark.asyncio
    async def test_circuit_opens_after_threshold(self):
        from app.services.cq_forwarder import CircuitBreaker, CircuitState
        cb = CircuitBreaker(name="test", threshold=3, timeout=60)
        
        assert cb.state == CircuitState.CLOSED
        
        await cb.record_failure()
        await cb.record_failure()
        assert cb.state == CircuitState.CLOSED  # 未达阈值
        
        await cb.record_failure()
        assert cb.state == CircuitState.OPEN    # 触发熔断

    @pytest.mark.asyncio
    async def test_circuit_recovers_after_timeout(self):
        import time
        from app.services.cq_forwarder import CircuitBreaker, CircuitState
        
        cb = CircuitBreaker(name="test_recover", threshold=1, timeout=0.1)
        await cb.record_failure()
        assert cb.state == CircuitState.OPEN
        
        # 等待超时
        import asyncio
        await asyncio.sleep(0.15)
        assert cb.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_circuit_closes_on_success(self):
        from app.services.cq_forwarder import CircuitBreaker, CircuitState
        
        cb = CircuitBreaker(name="test_close", threshold=1, timeout=0)
        await cb.record_failure()
        
        import asyncio
        await asyncio.sleep(0.01)
        assert cb.state == CircuitState.HALF_OPEN
        
        await cb.record_success()
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_is_available(self):
        from app.services.cq_forwarder import CircuitBreaker
        
        cb = CircuitBreaker(name="test_avail", threshold=2, timeout=60)
        assert cb.is_available() is True
        
        await cb.record_failure()
        await cb.record_failure()
        assert cb.is_available() is False


# ─────────────────────────────────────────────────────────────
# HTTP API 端点测试
# ─────────────────────────────────────────────────────────────

class TestHealthEndpoints:
    """健康检查端点测试"""

    def test_liveness(self, client):
        resp = client.get("/health/live")
        assert resp.status_code == 200
        assert resp.json()["alive"] is True

    def test_readiness_format(self, client):
        resp = client.get("/health/ready")
        data = resp.json()
        assert "ready" in data

    def test_health_full(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "status" in data
        assert "backend" in data
        assert data["service"] == "SG-API-Gateway"


class TestProxyEndpoint:
    """代理转发端点测试"""

    @pytest.mark.asyncio
    async def test_missing_api_key_returns_401(self, async_client):
        resp = await async_client.post(
            "/api/v1/forward",
            json={"path": "/v1/chat/completions", "payload": {"model": "test"}},
        )
        assert resp.status_code == 401
        assert resp.json()["detail"]["code"] == "AUTH_001"

    @pytest.mark.asyncio
    async def test_invalid_api_key_returns_401(self, async_client):
        resp = await async_client.post(
            "/api/v1/forward",
            json={"path": "/v1/chat", "payload": {}},
            headers={"X-API-Key": "invalid_short"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_forward_with_valid_key_calls_backend(self, async_client):
        from app.core.auth import APIKeyStore
        from app.models.tenant import APIKeyRecord
        
        raw_key = "test_forward_key_valid_12345678901"
        record = APIKeyRecord(tenant_id="tenant_test", project_id="proj_test")
        await APIKeyStore.store_record(raw_key, record)
        
        with patch("app.services.cq_forwarder.cq_service.forward", new_callable=AsyncMock) as mock_fwd:
            mock_fwd.return_value = (200, {"result": "ok", "model": "llama3"})
            
            resp = await async_client.post(
                "/api/v1/forward",
                json={
                    "path": "/v1/chat/completions",
                    "method": "POST",
                    "payload": {"model": "llama3", "messages": [{"role": "user", "content": "hi"}]},
                },
                headers={"X-API-Key": raw_key},
            )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["result"] == "ok"
        assert "request_id" in data["meta"]

    @pytest.mark.asyncio
    async def test_pdpa_fields_stripped_before_forwarding(self, async_client):
        from app.core.auth import APIKeyStore
        from app.models.tenant import APIKeyRecord
        
        raw_key = "test_pdpa_strip_key_12345678901234"
        record = APIKeyRecord(tenant_id="tenant_pdpa", project_id="proj_pdpa")
        await APIKeyStore.store_record(raw_key, record)
        
        captured_payload = {}
        
        async def capture_forward(path, method, payload, **kwargs):
            captured_payload.update(payload)
            return (200, {"ok": True})
        
        with patch("app.services.cq_forwarder.cq_service.forward", side_effect=capture_forward):
            await async_client.post(
                "/api/v1/forward",
                json={
                    "path": "/v1/infer",
                    "payload": {
                        "nric": "S1234567A",       # 应被阻断
                        "email": "user@test.com",   # 应被阻断
                        "prompt": "Hello world",    # 应通过
                        "model": "llama3",          # 应通过
                    },
                },
                headers={"X-API-Key": raw_key},
            )
        
        # 验证敏感字段没有到达后端
        assert "nric" not in captured_payload
        assert "email" not in captured_payload
        assert captured_payload.get("prompt") == "Hello world"
        assert captured_payload.get("model") == "llama3"

    @pytest.mark.asyncio
    async def test_backend_timeout_returns_504(self, async_client):
        from app.core.auth import APIKeyStore
        from app.models.tenant import APIKeyRecord
        from app.services.cq_forwarder import BackendTimeoutError
        
        raw_key = "test_timeout_key_xxxxxxxxxxx1234"
        record = APIKeyRecord(tenant_id="tenant_to", project_id="proj_to")
        await APIKeyStore.store_record(raw_key, record)
        
        with patch(
            "app.services.cq_forwarder.cq_service.forward",
            side_effect=BackendTimeoutError("timeout"),
        ):
            resp = await async_client.post(
                "/api/v1/forward",
                json={"path": "/v1/infer", "payload": {}},
                headers={"X-API-Key": raw_key},
            )
        
        assert resp.status_code == 504
        assert resp.json()["detail"]["code"] == "BACKEND_TIMEOUT"

    @pytest.mark.asyncio
    async def test_backend_unavailable_returns_503(self, async_client):
        from app.core.auth import APIKeyStore
        from app.models.tenant import APIKeyRecord
        from app.services.cq_forwarder import BackendUnavailableError

        raw_key = "test_unavail_key_xxxxxxxxxx56789"
        record = APIKeyRecord(tenant_id="tenant_ua", project_id="proj_ua")
        # Inject directly into in-memory store (no Redis in test env)
        key_hash = APIKeyStore._hash_key(raw_key)
        APIKeyStore._in_memory[key_hash] = record
        
        with patch(
            "app.services.cq_forwarder.cq_service.forward",
            side_effect=BackendUnavailableError("all nodes down"),
        ):
            resp = await async_client.post(
                "/api/v1/forward",
                json={"path": "/v1/infer", "payload": {}},
                headers={"X-API-Key": raw_key},
            )
        
        assert resp.status_code == 503
        assert resp.headers.get("Retry-After") == "30"


class TestAdminEndpoints:
    """管理接口测试"""

    @pytest.mark.asyncio
    async def test_create_key_requires_admin(self, async_client):
        resp = await async_client.post(
            "/admin/keys",
            json={"tenant_id": "t1", "project_id": "p1"},
            headers={"X-API-Key": "wrong_admin_key"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_and_use_key_full_flow(self, async_client):
        """完整流程：创建Key → 用该Key调用代理接口"""
        # 1. 用管理员 Key 创建新 Key
        create_resp = await async_client.post(
            "/admin/keys",
            json={
                "tenant_id": "integration_tenant",
                "project_id": "integration_project",
                "scope": "write",
                "rate_limit_qps": 50,
                "rate_limit_daily": 5000,
            },
            headers={"X-API-Key": "test_admin_key_for_unit_tests_only"},
        )
        assert create_resp.status_code == 200
        key_data = create_resp.json()
        assert "api_key" in key_data
        assert key_data["tenant_id"] == "integration_tenant"
        
        new_key = key_data["api_key"]
        
        # 2. 用新 Key 调用代理
        with patch(
            "app.services.cq_forwarder.cq_service.forward",
            new_callable=AsyncMock,
            return_value=(200, {"response": "success"}),
        ):
            proxy_resp = await async_client.post(
                "/api/v1/forward",
                json={"path": "/v1/test", "payload": {"query": "hello"}},
                headers={"X-API-Key": new_key},
            )
        
        assert proxy_resp.status_code == 200
        assert "X-Request-ID" in proxy_resp.headers

    @pytest.mark.asyncio
    async def test_revoke_key_prevents_access(self, async_client):
        """撤销Key后无法访问"""
        # 创建
        create_resp = await async_client.post(
            "/admin/keys",
            json={"tenant_id": "revoke_tenant", "project_id": "revoke_proj"},
            headers={"X-API-Key": "test_admin_key_for_unit_tests_only"},
        )
        new_key = create_resp.json()["api_key"]
        
        # 撤销
        # httpx DELETE with body: send as POST-style using request()
        import json as _json
        revoke_resp = await async_client.request(
            "DELETE",
            "/admin/keys",
            content=_json.dumps({"api_key": new_key}),
            headers={"X-API-Key": "test_admin_key_for_unit_tests_only", "Content-Type": "application/json"},
        )
        assert revoke_resp.json()["revoked"] is True
        
        # 尝试使用被撤销的 Key
        proxy_resp = await async_client.post(
            "/api/v1/forward",
            json={"path": "/v1/test", "payload": {}},
            headers={"X-API-Key": new_key},
        )
        assert proxy_resp.status_code == 401


# ─────────────────────────────────────────────────────────────
# 限流测试
# ─────────────────────────────────────────────────────────────

class TestRateLimitHeaders:
    """限流响应头验证"""

    @pytest.mark.asyncio
    async def test_response_has_request_id(self, async_client):
        resp = await async_client.get("/health/live")
        assert "X-Request-ID" in resp.headers

    @pytest.mark.asyncio
    async def test_response_has_timing_header(self, async_client):
        resp = await async_client.get("/health/live")
        assert "X-Response-Time-MS" in resp.headers
        elapsed = float(resp.headers["X-Response-Time-MS"])
        assert elapsed >= 0
