"""
结构化日志与PDPA审计日志模块
- 全链路请求追踪（trace_id / request_id）
- 自动脱敏敏感字段
- 双轨日志：运营日志 + PDPA审计日志
- 电信级留痕：不可篡改、可导出
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

from app.core.config import get_settings

settings = get_settings()

# ── 请求上下文变量 ──────────────────────────────────────────────────
_request_id_var: ContextVar[str] = ContextVar("request_id", default="")
_tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="")
_project_id_var: ContextVar[str] = ContextVar("project_id", default="")


def get_request_id() -> str:
    return _request_id_var.get() or str(uuid.uuid4())

def set_request_context(
    request_id: str = "",
    tenant_id: str = "",
    project_id: str = "",
) -> None:
    _request_id_var.set(request_id)
    _tenant_id_var.set(tenant_id)
    _project_id_var.set(project_id)


# ── PDPA 字段脱敏处理器 ────────────────────────────────────────────
BLOCKED_FIELDS = {f.lower() for f in settings.PDPA_BLOCKED_FIELDS}

_EMAIL_RE = re.compile(r"([^@]{1})([^@]*)(@.*)")
_PHONE_RE = re.compile(r"(\d{1})(\d+)(\d{4})")


def _mask_value(field: str, value: Any) -> Any:
    """按字段类型进行最小必要脱敏"""
    if not isinstance(value, str):
        return "***REDACTED***"
    
    pattern = settings.PDPA_MASK_PATTERNS.get(field.lower(), "full")
    
    if pattern == "partial":
        if "email" in field.lower():
            m = _EMAIL_RE.match(value)
            return f"{m.group(1)}***{m.group(3)}" if m else "***@***"
        if any(k in field.lower() for k in ("phone", "mobile", "tel")):
            m = _PHONE_RE.match(value)
            return f"{m.group(1)}***{m.group(3)}" if m else "****"
        if "ip" in field.lower():
            parts = value.split(".")
            return ".".join(parts[:2] + ["*", "*"]) if len(parts) == 4 else "***"
    
    return "***REDACTED***"


def _scrub_dict(data: dict[str, Any], depth: int = 0) -> dict[str, Any]:
    """递归脱敏字典，最大深度5层"""
    if depth > 5:
        return {"_truncated": True}
    
    result = {}
    for k, v in data.items():
        if k.lower() in BLOCKED_FIELDS:
            result[k] = _mask_value(k, v)
        elif isinstance(v, dict):
            result[k] = _scrub_dict(v, depth + 1)
        elif isinstance(v, list):
            result[k] = [
                _scrub_dict(item, depth + 1) if isinstance(item, dict) else item
                for item in v[:50]  # 防止超大列表
            ]
        else:
            result[k] = v
    return result


class PDPAScrubProcessor:
    """structlog 处理器：自动脱敏所有日志事件中的敏感字段"""
    
    def __call__(self, logger: WrappedLogger, method: str, event_dict: EventDict) -> EventDict:
        for key in list(event_dict.keys()):
            val = event_dict[key]
            if key.lower() in BLOCKED_FIELDS and isinstance(val, (str, int)):
                event_dict[key] = _mask_value(key, str(val))
            elif isinstance(val, dict):
                event_dict[key] = _scrub_dict(val)
        return event_dict


class RequestContextProcessor:
    """注入请求上下文到每条日志"""
    
    def __call__(self, logger: WrappedLogger, method: str, event_dict: EventDict) -> EventDict:
        rid = _request_id_var.get()
        tid = _tenant_id_var.get()
        pid = _project_id_var.get()
        if rid:
            event_dict["request_id"] = rid
        if tid:
            event_dict["tenant_id"] = tid
        if pid:
            event_dict["project_id"] = pid
        event_dict["ts"] = datetime.now(timezone.utc).isoformat()
        return event_dict


# ── PDPA 审计日志（独立文件，不可覆盖）──────────────────────────────
class PDPAAuditLogger:
    """
    PDPA专项审计日志
    记录：数据跨境传输事件、字段过滤决策、敏感字段访问
    格式：NDJSON，追加写入，不允许覆盖
    """
    
    def __init__(self) -> None:
        self._file = None
        if settings.AUDIT_LOG_FILE:
            Path(settings.AUDIT_LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
            self._file = open(settings.AUDIT_LOG_FILE, "a", encoding="utf-8", buffering=1)
    
    def log_cross_border_transfer(
        self,
        request_id: str,
        tenant_id: str,
        endpoint: str,
        fields_forwarded: list[str],
        fields_blocked: list[str],
        destination: str = "Chongqing-CQ",
    ) -> None:
        record = {
            "event": "CROSS_BORDER_DATA_TRANSFER",
            "ts": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "tenant_id": tenant_id,
            "endpoint": endpoint,
            "destination": destination,
            "fields_forwarded_count": len(fields_forwarded),
            "fields_forwarded": fields_forwarded,
            "fields_blocked": fields_blocked,
            "legal_basis": "Singapore-Chongqing ICT Cooperation Framework / IMDA",
        }
        self._write(record)
    
    def log_sensitive_field_blocked(
        self,
        request_id: str,
        tenant_id: str,
        field_name: str,
        reason: str = "PDPA_MINIMUM_NECESSARY",
    ) -> None:
        record = {
            "event": "SENSITIVE_FIELD_BLOCKED",
            "ts": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "tenant_id": tenant_id,
            "field_name": field_name,
            "reason": reason,
        }
        self._write(record)
    
    def log_api_key_event(
        self,
        request_id: str,
        event_type: str,  # AUTH_SUCCESS | AUTH_FAILURE | KEY_CREATED | KEY_REVOKED
        tenant_id: str = "",
        ip_address: str = "",
    ) -> None:
        record = {
            "event": f"APIKEY_{event_type}",
            "ts": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "tenant_id": tenant_id,
            "ip_hash": hashlib.sha256(ip_address.encode()).hexdigest()[:16] if ip_address else "",
        }
        self._write(record)
    
    def _write(self, record: dict) -> None:
        if self._file:
            self._file.write(json.dumps(record, ensure_ascii=False) + "\n")
    
    def __del__(self) -> None:
        if self._file:
            self._file.close()


# ── 日志初始化 ─────────────────────────────────────────────────────
def setup_logging() -> None:
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        RequestContextProcessor(),
        PDPAScrubProcessor(),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
    ]
    
    if settings.LOG_FORMAT == "json":
        renderer = structlog.processors.JSONRenderer(serializer=json.dumps)
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    
    structlog.configure(
        processors=shared_processors + [
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # 同时配置标准库 logging（uvicorn/httpx等使用）
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    return structlog.get_logger(name)


# 全局审计日志实例
audit_logger = PDPAAuditLogger()
