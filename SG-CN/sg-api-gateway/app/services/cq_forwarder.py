"""
中新链路转发服务 - 电信级可靠性
架构：新加坡接入 → PDPA过滤 → 重庆后端（主/备）

核心特性：
- 熔断器（Circuit Breaker）：防止级联故障
- 主备自动切换：主节点故障自动切至备节点
- 健康检查：后台异步定期探测
- 重试策略：指数退避，最大N次
- 完整链路追踪
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


# ── 熔断器状态机 ──────────────────────────────────────────────────
class CircuitState(str, Enum):
    CLOSED = "CLOSED"       # 正常通行
    OPEN = "OPEN"           # 熔断，拒绝请求
    HALF_OPEN = "HALF_OPEN" # 试探恢复


@dataclass
class CircuitBreaker:
    """
    滑动窗口熔断器
    - CLOSED → OPEN：连续失败 >= threshold
    - OPEN → HALF_OPEN：经过 timeout 秒
    - HALF_OPEN → CLOSED：探测请求成功
    - HALF_OPEN → OPEN：探测请求失败
    """
    name: str
    threshold: int = 5
    timeout: float = 60.0
    
    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _fail_count: int = field(default=0, init=False)
    _last_opened: float = field(default=0.0, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)
    
    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_opened >= self.timeout:
                self._state = CircuitState.HALF_OPEN
                logger.info("Circuit half-opened", circuit=self.name)
        return self._state
    
    async def record_success(self) -> None:
        async with self._lock:
            self._fail_count = 0
            if self._state in (CircuitState.OPEN, CircuitState.HALF_OPEN):
                self._state = CircuitState.CLOSED
                logger.info("Circuit closed (recovered)", circuit=self.name)
    
    async def record_failure(self) -> None:
        async with self._lock:
            self._fail_count += 1
            if self._fail_count >= self.threshold or self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                self._last_opened = time.monotonic()
                logger.warning(
                    "Circuit opened",
                    circuit=self.name,
                    fail_count=self._fail_count,
                    threshold=self.threshold,
                )
    
    def is_available(self) -> bool:
        return self.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN)
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "state": self.state.value,
            "fail_count": self._fail_count,
            "threshold": self.threshold,
        }


# ── 后端节点 ──────────────────────────────────────────────────────
@dataclass
class BackendNode:
    name: str
    base_url: str
    is_primary: bool = True
    healthy: bool = True
    last_check: float = field(default_factory=time.monotonic)
    consecutive_failures: int = 0
    circuit: CircuitBreaker = field(init=False)
    
    def __post_init__(self) -> None:
        self.circuit = CircuitBreaker(
            name=f"cb_{self.name}",
            threshold=settings.CQ_CIRCUIT_BREAKER_THRESHOLD,
            timeout=settings.CQ_CIRCUIT_BREAKER_TIMEOUT,
        )
    
    def is_available(self) -> bool:
        return self.healthy and self.circuit.is_available()
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "base_url": self.base_url,
            "is_primary": self.is_primary,
            "healthy": self.healthy,
            "circuit": self.circuit.to_dict(),
            "last_check_ago_secs": round(time.monotonic() - self.last_check, 1),
        }


# ── 中新链路转发服务 ──────────────────────────────────────────────
class CQForwardingService:
    """
    新加坡→重庆 统一转发服务
    
    设计原则：
    - 优先使用主节点
    - 主节点不可用时自动切至备节点
    - 两者均不可用时返回 503 并附带诊断信息
    - 全程写入结构化日志
    """
    
    def __init__(self) -> None:
        self._primary = BackendNode(
            name="cq-primary",
            base_url=settings.CQ_BACKEND_PRIMARY,
            is_primary=True,
        )
        self._standby = BackendNode(
            name="cq-standby",
            base_url=settings.CQ_BACKEND_STANDBY,
            is_primary=False,
        )
        
        # 共享 httpx 连接池
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=settings.CQ_BACKEND_CONNECT_TIMEOUT,
                read=settings.CQ_BACKEND_TIMEOUT,
                write=30.0,
                pool=5.0,
            ),
            limits=httpx.Limits(
                max_connections=200,
                max_keepalive_connections=50,
                keepalive_expiry=30.0,
            ),
            http2=True,   # 电信级优化：HTTP/2 多路复用
            verify=True,  # 强制 TLS 验证
        )
        
        self._health_check_task: asyncio.Task | None = None
    
    async def startup(self) -> None:
        """应用启动时调用"""
        await self._check_node(self._primary)
        await self._check_node(self._standby)
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        logger.info(
            "CQ forwarding service started",
            primary=self._primary.base_url,
            standby=self._standby.base_url,
        )
    
    async def shutdown(self) -> None:
        """应用关闭时调用"""
        if self._health_check_task:
            self._health_check_task.cancel()
        await self._client.aclose()
        logger.info("CQ forwarding service stopped")
    
    def _select_node(self) -> BackendNode | None:
        """节点选择：优先主节点，主节点不可用切备"""
        if self._primary.is_available():
            return self._primary
        if self._standby.is_available():
            logger.warning("Failover to standby node", primary_state=self._primary.circuit.state)
            return self._standby
        return None
    
    async def forward(
        self,
        path: str,
        method: str,
        payload: dict[str, Any],
        extra_headers: dict[str, str] | None = None,
        request_id: str = "",
        tenant_id: str = "",
        timeout_override: float | None = None,
    ) -> tuple[int, dict[str, Any]]:
        """
        转发请求至重庆后端
        
        Returns:
            (status_code, response_body)
        Raises:
            BackendUnavailableError: 所有节点不可用
            BackendTimeoutError: 请求超时
        """
        node = self._select_node()
        if not node:
            logger.error(
                "All CQ backend nodes unavailable",
                primary=self._primary.circuit.state,
                standby=self._standby.circuit.state,
            )
            raise BackendUnavailableError("All backend nodes are unavailable")
        
        url = f"{node.base_url.rstrip('/')}/{path.lstrip('/')}"
        headers = {
            "Content-Type": "application/json",
            "X-Forwarded-From": "sg-api-gateway",
            "X-Request-ID": request_id,
            "X-Tenant-ID": tenant_id,
            "X-Gateway-Version": settings.APP_VERSION,
        }
        if extra_headers:
            headers.update({
                k: v for k, v in extra_headers.items()
                if k.lower() not in ("authorization", "x-api-key", "cookie")  # 不透传鉴权头
            })
        
        timeout = timeout_override or settings.CQ_BACKEND_TIMEOUT
        start_ts = time.monotonic()
        
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(settings.CQ_MAX_RETRIES),
                wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
                retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
                reraise=True,
            ):
                with attempt:
                    response = await self._client.request(
                        method=method.upper(),
                        url=url,
                        json=payload,
                        headers=headers,
                        timeout=timeout,
                    )
            
            elapsed_ms = (time.monotonic() - start_ts) * 1000
            await node.circuit.record_success()
            node.consecutive_failures = 0
            
            logger.info(
                "CQ forward success",
                node=node.name,
                path=path,
                status=response.status_code,
                elapsed_ms=round(elapsed_ms, 1),
            )
            
            try:
                body = response.json()
            except Exception:
                body = {"raw": response.text}
            
            return response.status_code, body
        
        except httpx.TimeoutException as e:
            elapsed_ms = (time.monotonic() - start_ts) * 1000
            await node.circuit.record_failure()
            node.consecutive_failures += 1
            logger.error(
                "CQ backend timeout",
                node=node.name,
                path=path,
                elapsed_ms=round(elapsed_ms, 1),
                error=str(e),
            )
            raise BackendTimeoutError(f"Backend timeout after {elapsed_ms:.0f}ms") from e
        
        except httpx.TransportError as e:
            await node.circuit.record_failure()
            node.consecutive_failures += 1
            logger.error("CQ backend transport error", node=node.name, error=str(e))
            raise BackendUnavailableError(f"Transport error: {e}") from e
        
        except RetryError as e:
            await node.circuit.record_failure()
            raise BackendUnavailableError(f"All retries exhausted: {e}") from e
    
    async def _check_node(self, node: BackendNode) -> bool:
        """单节点健康探测"""
        try:
            resp = await self._client.get(
                f"{node.base_url}{settings.CQ_HEALTH_CHECK_PATH}",
                timeout=httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=3.0),
                headers={"X-Health-Check": "sg-gateway"},
            )
            was_healthy = node.healthy
            node.healthy = resp.status_code < 500
            node.last_check = time.monotonic()
            
            if node.healthy:
                await node.circuit.record_success()
                if not was_healthy:
                    logger.info("Backend node recovered", node=node.name)
            else:
                await node.circuit.record_failure()
                logger.warning("Backend node unhealthy", node=node.name, status=resp.status_code)
            
            return node.healthy
        
        except Exception as e:
            node.healthy = False
            node.last_check = time.monotonic()
            await node.circuit.record_failure()
            logger.warning("Backend node health check failed", node=node.name, error=str(e))
            return False
    
    async def _health_check_loop(self) -> None:
        """后台定期健康检查循环"""
        while True:
            try:
                await asyncio.sleep(settings.CQ_HEALTH_CHECK_INTERVAL)
                await asyncio.gather(
                    self._check_node(self._primary),
                    self._check_node(self._standby),
                    return_exceptions=True,
                )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Health check loop error", error=str(e))
    
    def get_status(self) -> dict[str, Any]:
        """返回后端链路状态摘要（供 /health 接口使用）"""
        return {
            "primary": self._primary.to_dict(),
            "standby": self._standby.to_dict(),
            "any_available": self._select_node() is not None,
        }


class BackendUnavailableError(Exception):
    pass


class BackendTimeoutError(Exception):
    pass


# 全局单例
cq_service = CQForwardingService()
