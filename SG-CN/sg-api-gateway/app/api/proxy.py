"""
核心代理路由 - 统一 API 入口
接收外部请求 → PDPA过滤 → 转发重庆后端 → 返回结果
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import ORJSONResponse

from app.core.auth import authenticate_request
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.tenant import APIKeyRecord, GatewayProxyRequest
from app.services.cq_forwarder import BackendTimeoutError, BackendUnavailableError, cq_service
from app.services.pdpa_filter import get_pdpa_filter

settings = get_settings()
logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Proxy"])


@router.post(
    "/forward",
    summary="统一转发接口",
    description="""
将请求经 PDPA 字段过滤后转发至重庆后端。
- 自动脱敏/屏蔽 PDPA 受限字段
- 支持主备自动切换
- 全程生成审计日志
""",
)
async def forward_to_cq(
    body: GatewayProxyRequest,
    request: Request,
    auth: Annotated[APIKeyRecord, Depends(authenticate_request)],
) -> ORJSONResponse:
    request_id = request.state.request_id
    tenant_id = auth.tenant_id
    project_id = auth.project_id
    
    # ── 路径白名单检查 ──────────────────────────────────────────────
    if auth.allowed_paths:
        if not any(body.path.startswith(p) for p in auth.allowed_paths):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "AUTHZ_001",
                    "message": f"Path '{body.path}' is not allowed for this API key.",
                },
            )
    
    # ── PDPA 字段过滤 ──────────────────────────────────────────────
    pdpa_filter = get_pdpa_filter()
    filter_result = pdpa_filter.filter(
        payload=body.payload,
        request_id=request_id,
        tenant_id=tenant_id,
        endpoint=body.path,
    )
    
    # ── 构建转发 headers ────────────────────────────────────────────
    forward_headers = {
        "X-Tenant-ID": tenant_id,
        "X-Project-ID": project_id,
        "X-Forwarded-Request-ID": request_id,
    }
    
    # ── 转发至重庆 ──────────────────────────────────────────────────
    try:
        status_code, response_body = await cq_service.forward(
            path=body.path,
            method=body.method,
            payload=filter_result.clean_payload,
            extra_headers=forward_headers,
            request_id=request_id,
            tenant_id=tenant_id,
            timeout_override=body.timeout_override,
        )
    except BackendTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "BACKEND_TIMEOUT",
                "message": "Backend inference timeout. Please retry.",
                "request_id": request_id,
            },
        )
    except BackendUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "BACKEND_UNAVAILABLE",
                "message": "Backend service temporarily unavailable.",
                "request_id": request_id,
            },
            headers={"Retry-After": "30"},
        )
    
    # ── 包装响应 ────────────────────────────────────────────────────
    gateway_response = {
        "data": response_body,
        "meta": {
            "request_id": request_id,
            "backend_status": status_code,
            "fields_filtered": len(filter_result.blocked_fields),
            "gateway": settings.APP_NAME,
        },
    }
    
    return ORJSONResponse(content=gateway_response, status_code=status_code if status_code < 500 else 502)


@router.get(
    "/compliance/field-policy",
    summary="查看当前 PDPA 字段过滤策略",
)
async def get_field_policy(
    auth: Annotated[APIKeyRecord, Depends(authenticate_request)],
) -> dict[str, Any]:
    """返回全局及当前租户的 PDPA 字段过滤策略说明"""
    pdpa_filter = get_pdpa_filter()
    return {
        "policy": pdpa_filter.get_compliance_summary(),
        "note": "Fields listed in 'blocked' will never be forwarded to Chongqing backend.",
        "legal_basis": "Singapore PDPA (Personal Data Protection Act 2012), PDPC Transfer Limitation Obligation",
    }
