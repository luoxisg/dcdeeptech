"""
PDPA 合规字段过滤服务
实现「最小必要、边界清晰、可追溯」原则：
1. 阻断 PDPA_BLOCKED_FIELDS 中的字段进入转发请求
2. 对日志中的敏感字段执行脱敏
3. 生成每次跨境传输的合规记录
4. 支持租户级自定义过滤规则
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings
from app.core.logging import audit_logger, get_logger

settings = get_settings()
logger = get_logger(__name__)

# 全局阻断字段集（小写）
_GLOBAL_BLOCKED: frozenset[str] = frozenset(
    f.lower() for f in settings.PDPA_BLOCKED_FIELDS
)


@dataclass
class FilterResult:
    """字段过滤结果"""
    clean_payload: dict[str, Any]
    blocked_fields: list[str] = field(default_factory=list)
    forwarded_fields: list[str] = field(default_factory=list)
    compliance_notes: list[str] = field(default_factory=list)


class PDPAFilter:
    """
    PDPA 合规字段过滤器
    
    过滤优先级（从高到低）：
      1. 租户级阻断字段（tenant_blocked）
      2. 全局阻断字段（PDPA_BLOCKED_FIELDS）
      3. 租户级白名单（若配置，则仅允许白名单字段通过）
      4. 全局白名单（若配置）
    """
    
    def __init__(
        self,
        tenant_blocked_fields: list[str] | None = None,
        tenant_allowed_fields: list[str] | None = None,
    ) -> None:
        self._tenant_blocked = frozenset(
            f.lower() for f in (tenant_blocked_fields or [])
        )
        self._tenant_allowed = frozenset(
            f.lower() for f in (tenant_allowed_fields or [])
        ) if tenant_allowed_fields else None
        
        self._global_allowed = frozenset(
            f.lower() for f in settings.PDPA_FORWARD_WHITELIST
        ) if settings.PDPA_FORWARD_WHITELIST else None
    
    def filter(
        self,
        payload: dict[str, Any],
        request_id: str = "",
        tenant_id: str = "",
        endpoint: str = "",
    ) -> FilterResult:
        """
        过滤请求体，返回合规净化后的 payload 及审计信息
        """
        result = FilterResult(clean_payload={})
        self._process_dict(payload, result, request_id, tenant_id, depth=0)
        
        # 写入 PDPA 跨境传输审计日志
        if request_id:
            audit_logger.log_cross_border_transfer(
                request_id=request_id,
                tenant_id=tenant_id,
                endpoint=endpoint,
                fields_forwarded=result.forwarded_fields,
                fields_blocked=result.blocked_fields,
            )
            
            for blocked_field in result.blocked_fields:
                audit_logger.log_sensitive_field_blocked(
                    request_id=request_id,
                    tenant_id=tenant_id,
                    field_name=blocked_field,
                )
        
        if result.blocked_fields:
            logger.info(
                "PDPA filter blocked fields",
                blocked_count=len(result.blocked_fields),
                blocked_fields=result.blocked_fields,
                endpoint=endpoint,
            )
        
        return result
    
    def _should_block(self, field_name: str) -> tuple[bool, str]:
        """
        判断字段是否应被阻断
        返回 (should_block, reason)
        """
        fn = field_name.lower()
        
        if fn in self._tenant_blocked:
            return True, "TENANT_BLOCKED"
        
        if fn in _GLOBAL_BLOCKED:
            return True, "PDPA_BLOCKED"
        
        # 白名单过滤（若配置了白名单，则不在名单内的一律阻断）
        if self._tenant_allowed is not None and fn not in self._tenant_allowed:
            return True, "NOT_IN_TENANT_WHITELIST"
        
        if self._global_allowed is not None and fn not in self._global_allowed:
            return True, "NOT_IN_GLOBAL_WHITELIST"
        
        return False, ""
    
    def _process_dict(
        self,
        data: dict[str, Any],
        result: FilterResult,
        request_id: str,
        tenant_id: str,
        depth: int,
    ) -> dict[str, Any]:
        if depth > 8:
            result.compliance_notes.append("max_depth_reached")
            return {}
        
        clean = {}
        for key, value in data.items():
            should_block, reason = self._should_block(key)
            
            if should_block:
                result.blocked_fields.append(f"{key}({reason})")
                # 不写入 clean，字段完全从转发请求中消除
                continue
            
            if isinstance(value, dict):
                nested = self._process_dict(value, result, request_id, tenant_id, depth + 1)
                clean[key] = nested
                result.forwarded_fields.append(f"{key}(nested)")
            elif isinstance(value, list):
                cleaned_list = []
                for item in value:
                    if isinstance(item, dict):
                        nested = self._process_dict(item, result, request_id, tenant_id, depth + 1)
                        cleaned_list.append(nested)
                    else:
                        cleaned_list.append(item)
                clean[key] = cleaned_list
                result.forwarded_fields.append(key)
            else:
                clean[key] = value
                result.forwarded_fields.append(key)
        
        result.clean_payload = clean if depth == 0 else result.clean_payload
        return clean
    
    def get_compliance_summary(self) -> dict[str, Any]:
        """返回当前过滤器配置摘要（用于 API 文档 / 审计）"""
        return {
            "global_blocked_fields": sorted(_GLOBAL_BLOCKED),
            "tenant_blocked_fields": sorted(self._tenant_blocked),
            "tenant_allowed_fields": sorted(self._tenant_allowed) if self._tenant_allowed else None,
            "global_allowed_fields": sorted(self._global_allowed) if self._global_allowed else None,
            "policy": "minimum_necessary",
        }


# ── 默认全局过滤器实例 ────────────────────────────────────────────
_default_filter = PDPAFilter()


def get_pdpa_filter(
    tenant_blocked: list[str] | None = None,
    tenant_allowed: list[str] | None = None,
) -> PDPAFilter:
    """获取PDPA过滤器（无租户自定义时复用全局实例）"""
    if tenant_blocked or tenant_allowed:
        return PDPAFilter(tenant_blocked, tenant_allowed)
    return _default_filter
