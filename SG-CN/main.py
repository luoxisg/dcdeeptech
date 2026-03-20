 """
新加坡—中国跨境 AI 网关 · 新加坡节点
SG-CN AI Gateway — Singapore Node
api.dcdeeptech.com

架构说明：
    海外客户端
        ↓  Bearer Token 鉴权
    新加坡 API 网关（本文件）
        ↓  加密跨境隧道
    中国 GPU 算力集群（Sophnet 提供）
        vLLM + Qwen-VL 多模态推理
        ↑
    返回 OpenAI 兼容格式响应

【对 Sophnet 上游接口的要求】见文件底部 SOPHNET_CONTRACT 注释块。
"""

# =============================================================================
# 标准库
# =============================================================================
import os
import time
import uuid
import logging
from contextlib import asynccontextmanager
from typing import Any

# =============================================================================
# 第三方依赖
#   pip install fastapi uvicorn httpx python-dotenv pydantic
# =============================================================================
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 自动读取同目录下的 .env 文件（生产环境建议通过容器环境变量注入，无需 .env）
load_dotenv()

# =============================================================================
# 日志配置
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("sg-cn-gateway")

# =============================================================================
# 配置项（全部来自环境变量 / .env）
#
# 【网关自身配置】
#   GATEWAY_API_KEY   对外暴露给客户端的 Bearer Token，必填
#   GATEWAY_HOST      监听地址，默认 0.0.0.0
#   GATEWAY_PORT      监听端口，默认 8000
#
# 【Sophnet 上游配置】（由 Sophnet 方提供，详见底部合约）
#   SOPHNET_API_URL   Sophnet 推理入口 URL，必填
#   SOPHNET_API_KEY   Sophnet 鉴权密钥，必填
#   SOPHNET_AUTH_MODE 鉴权方式：bearer（默认）
#
# 【推理配置】
#   DEFAULT_MODEL     默认模型名称，默认 qwenvl
#   REQUEST_TIMEOUT   单次请求超时（秒），默认 60
# =============================================================================

# ── 网关自身 ──────────────────────────────────────────────────────────────────
GATEWAY_API_KEY: str  = os.environ["GATEWAY_API_KEY"]    # 必填，客户端鉴权用
GATEWAY_HOST: str     = os.getenv("GATEWAY_HOST", "0.0.0.0")
GATEWAY_PORT: int     = int(os.getenv("GATEWAY_PORT", "8000"))

# ── Sophnet 上游（中国侧 GPU 集群）────────────────────────────────────────────
SOPHNET_API_URL: str   = os.environ["SOPHNET_API_URL"].rstrip("/")   # 必填，由 Sophnet 提供
SOPHNET_API_KEY: str   = os.environ["SOPHNET_API_KEY"]               # 必填，由 Sophnet 提供
SOPHNET_AUTH_MODE: str = os.getenv("SOPHNET_AUTH_MODE", "bearer")    # bearer（默认）

# ── 推理 ──────────────────────────────────────────────────────────────────────
DEFAULT_MODEL: str     = os.getenv("DEFAULT_MODEL", "qwenvl")        # Sophnet 上部署的模型名
REQUEST_TIMEOUT: float = float(os.getenv("REQUEST_TIMEOUT", "60"))   # 秒；Sophnet 冷启动可能较慢

# 拼接上游接口完整 URL（Sophnet 必须提供以下两个路径，详见底部合约）
UPSTREAM_CHAT_URL   = f"{SOPHNET_API_URL}/v1/chat/completions"
UPSTREAM_MODELS_URL = f"{SOPHNET_API_URL}/v1/models"


# =============================================================================
# 全局 HTTP 客户端（连接池复用，避免每次请求重建 TCP 连接）
# =============================================================================
_http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 生命周期钩子：启动时初始化 HTTP 客户端，关闭时优雅释放连接。"""
    global _http_client
    _http_client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
    logger.info("HTTP 客户端已初始化，超时 %.1fs", REQUEST_TIMEOUT)
    yield
    await _http_client.aclose()
    logger.info("HTTP 客户端已关闭")


# =============================================================================
# FastAPI 应用实例
# =============================================================================
app = FastAPI(
    title="SG-CN AI Gateway",
    description="新加坡—中国跨境 AI 网关（OpenAI 兼容接口）",
    version="1.0.0",
    lifespan=lifespan,
)

# 允许所有来源跨域请求（POC 阶段；生产环境应收紧 allow_origins）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# 鉴权：验证客户端 Bearer Token
# =============================================================================

def verify_api_key(request: Request) -> None:
    """
    校验请求头中的 Authorization: Bearer <token>。
    token 必须与环境变量 GATEWAY_API_KEY 一致，否则返回 401。
    此函数以 FastAPI Depends 方式注入到需要保护的路由。
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少 Bearer Token")
    token = auth.removeprefix("Bearer ").strip()
    if token != GATEWAY_API_KEY:
        raise HTTPException(status_code=401, detail="API Key 无效")


# =============================================================================
# 上游（Sophnet）请求头构造
# =============================================================================

def _upstream_headers() -> dict[str, str]:
    """
    根据 SOPHNET_AUTH_MODE 构造发往 Sophnet 的鉴权请求头。
    当前支持 bearer 模式；如 Sophnet 后续支持其他鉴权方式，可在此扩展。

    【Sophnet 要求】上游必须接受 Authorization: Bearer <SOPHNET_API_KEY> 头。
    """
    if SOPHNET_AUTH_MODE == "bearer":
        return {
            "Authorization": f"Bearer {SOPHNET_API_KEY}",
            "Content-Type": "application/json",
        }
    # 预留扩展：basic / x-api-key 等
    logger.warning("未知的 SOPHNET_AUTH_MODE=%s，跳过鉴权头", SOPHNET_AUTH_MODE)
    return {"Content-Type": "application/json"}


# =============================================================================
# Pydantic 数据模型（OpenAI 兼容子集）
# =============================================================================

class ContentPart(BaseModel):
    """
    消息内容块，支持纯文本和图片 URL（Qwen-VL 多模态）。

    文本块示例：{"type": "text", "text": "你好"}
    图片块示例：{"type": "image_url", "image_url": {"url": "https://..."}}
    """
    type: str                                # "text" 或 "image_url"
    text: str | None = None                  # type=text 时有效
    image_url: dict[str, str] | None = None  # type=image_url 时有效


class Message(BaseModel):
    """单条对话消息，content 支持纯字符串（文本）或 ContentPart 列表（多模态）。"""
    role: str                                # "user" | "assistant" | "system"
    content: str | list[ContentPart]


class ChatCompletionRequest(BaseModel):
    """
    /v1/chat/completions 请求体，完全兼容 OpenAI 格式。
    extra="allow" 允许透传任意额外字段到 Sophnet 上游。
    """
    model: str = DEFAULT_MODEL               # 模型名，对应 Sophnet 部署的模型
    messages: list[Message]                  # 对话历史（至少一条）
    stream: bool = False                     # True = SSE 流式输出
    temperature: float | None = None         # 采样温度，0~2
    max_tokens: int | None = None            # 最大生成 token 数
    top_p: float | None = None               # nucleus 采样概率
    stop: str | list[str] | None = None      # 停止词
    # 透传字段容器（不常用参数由此转发给 Sophnet）
    extra: dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"  # 接收并保留未声明字段，供 adapt_request_to_vllm 透传


# =============================================================================
# 协议适配层：OpenAI ↔ vLLM（Sophnet 上游）
# =============================================================================

def adapt_request_to_vllm(req: ChatCompletionRequest) -> dict:
    """
    将网关收到的 OpenAI 格式请求转换为 Sophnet/vLLM 接受的 payload。

    处理逻辑：
    1. 基础字段直接映射（model / messages / stream）
    2. 可选推理参数仅在非 None 时写入，避免覆盖 Sophnet 侧默认值
    3. 客户端传入的额外字段（model_extra）透传给上游

    【Sophnet 要求】
    - POST /v1/chat/completions 必须支持字段：
        model, messages, stream, temperature, max_tokens, top_p, stop
    - messages[].content 若为列表，需支持 image_url 类型（Qwen-VL 多模态）
    """
    payload: dict[str, Any] = {
        "model": req.model,
        "messages": [m.model_dump(exclude_none=True) for m in req.messages],
        "stream": req.stream,
    }
    # 仅写入客户端显式指定的推理参数
    for opt in ("temperature", "max_tokens", "top_p", "stop"):
        val = getattr(req, opt)
        if val is not None:
            payload[opt] = val
    # 透传任意额外字段（如 Sophnet 私有扩展参数）
    payload.update(req.model_extra or {})
    return payload


def adapt_vllm_response(upstream: dict, model_override: str) -> dict:
    """
    将 Sophnet/vLLM 返回的响应体规范化为标准 OpenAI schema。

    vLLM 已基本兼容 OpenAI 格式，此函数负责补全可能缺失的字段，
    确保客户端（尤其是 OpenAI Python SDK）解析不报错。

    【Sophnet 要求】
    - 响应体应包含 choices 列表，每个 choice 含 message.role / message.content
    - 如上游已返回完整 OpenAI 格式，此函数仅做 model 字段覆写
    """
    resp = dict(upstream)
    resp.setdefault("id", f"chatcmpl-{uuid.uuid4().hex}")   # 补全请求 ID
    resp.setdefault("object", "chat.completion")             # 补全对象类型
    resp.setdefault("created", int(time.time()))             # 补全时间戳
    resp["model"] = model_override                           # 统一对外显示的模型名
    for choice in resp.get("choices", []):
        choice.setdefault("finish_reason", "stop")           # 补全终止原因
        msg = choice.get("message", {})
        msg.setdefault("role", "assistant")                  # 补全角色
        choice["message"] = msg
    return resp


# =============================================================================
# 路由
# =============================================================================

@app.get("/health", tags=["Meta"])
async def health_check():
    """
    存活探针，无需鉴权。
    用于 AWS/GCP 负载均衡器健康检查、Uptime Robot 等监控工具。
    返回 200 仅表示网关进程正常运行，不代表 Sophnet 上游可达。
    """
    return {
        "status": "ok",
        "gateway": "sg-cn-ai-gateway",
        "region": "Singapore",
        "timestamp": int(time.time()),
    }


@app.get(
    "/v1/models",
    tags=["Models"],
    dependencies=[Depends(verify_api_key)],   # 需要客户端 Bearer Token
)
async def list_models():
    """
    列出可用模型，代理转发至 Sophnet GET /v1/models。

    【Sophnet 要求】
    - GET /v1/models 必须返回 OpenAI 兼容的 model list 格式：
        {"object": "list", "data": [{"id": "qwenvl", ...}, ...]}
    """
    t0 = time.perf_counter()
    try:
        r = await _http_client.get(UPSTREAM_MODELS_URL, headers=_upstream_headers())
        r.raise_for_status()
        latency_ms = (time.perf_counter() - t0) * 1000
        logger.info("list_models  上游状态=%d  延迟=%.0fms", r.status_code, latency_ms)
        return r.json()
    except httpx.HTTPStatusError as exc:
        logger.error("list_models 上游 HTTP 错误: %s", exc)
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    except httpx.RequestError as exc:
        logger.error("list_models 网络错误: %s", exc)
        raise HTTPException(status_code=502, detail="上游 Sophnet 节点不可达")


@app.post(
    "/v1/chat/completions",
    tags=["Inference"],
    dependencies=[Depends(verify_api_key)],   # 需要客户端 Bearer Token
)
async def chat_completions(request: Request, req: ChatCompletionRequest):
    """
    核心推理接口，完全兼容 OpenAI /v1/chat/completions。

    支持：
    - 纯文本对话（model=qwenvl，content 为字符串）
    - 图文多模态（model=qwenvl，content 含 image_url 块，由 Qwen-VL 处理）
    - 流式输出（stream=true，SSE 格式，逐 token 返回）

    【Sophnet 要求】
    - 流式模式（stream=true）：上游以 SSE 格式返回数据块
        每块：data: {"choices": [{"delta": {...}}]}\n\n
        结束：data: [DONE]\n\n
    - 非流式模式：上游返回完整 OpenAI chat.completion JSON 对象
    """
    payload = adapt_request_to_vllm(req)
    t0 = time.perf_counter()
    # 生成本次请求的唯一追踪 ID，贯穿日志和响应头
    request_id = f"req-{uuid.uuid4().hex[:8]}"

    logger.info(
        "%s  model=%s  stream=%s  消息数=%d",
        request_id, req.model, req.stream, len(req.messages),
    )

    # ── 流式模式（SSE）────────────────────────────────────────────────────────
    if req.stream:
        async def event_stream():
            """
            异步生成器：与 Sophnet 建立流式连接，将上游 SSE 数据块
            原样转发给客户端（透明代理，零拷贝）。
            """
            try:
                async with _http_client.stream(
                    "POST",
                    UPSTREAM_CHAT_URL,
                    json=payload,
                    headers=_upstream_headers(),
                ) as upstream_resp:
                    upstream_resp.raise_for_status()
                    async for chunk in upstream_resp.aiter_bytes():
                        yield chunk   # 原样转发每个 SSE 数据块
                latency_ms = (time.perf_counter() - t0) * 1000
                logger.info("%s  流式完成  总延迟=%.0fms", request_id, latency_ms)
            except httpx.HTTPStatusError as exc:
                logger.error("%s  流式上游错误: %s", request_id, exc)
                yield b"data: [DONE]\n\n"   # 发送终止标记，防止客户端挂起
            except httpx.RequestError as exc:
                logger.error("%s  流式网络错误: %s", request_id, exc)
                yield b"data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"X-Request-Id": request_id},
        )

    # ── 非流式模式（完整 JSON 响应）──────────────────────────────────────────
    try:
        r = await _http_client.post(
            UPSTREAM_CHAT_URL,
            json=payload,
            headers=_upstream_headers(),
        )
        r.raise_for_status()
        latency_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "%s  上游状态=%d  延迟=%.0fms",
            request_id, r.status_code, latency_ms,
        )
        # 规范化响应格式后返回
        adapted = adapt_vllm_response(r.json(), req.model)
        return JSONResponse(content=adapted, headers={"X-Request-Id": request_id})

    except httpx.HTTPStatusError as exc:
        logger.error(
            "%s  上游 HTTP %d 错误: %s",
            request_id, exc.response.status_code, exc.response.text,
        )
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        )
    except httpx.RequestError as exc:
        logger.error("%s  网络错误（Sophnet 不可达）: %s", request_id, exc)
        raise HTTPException(status_code=502, detail="Sophnet 推理集群不可达，请稍后重试")


# =============================================================================
# 启动入口（直接运行 python main.py 时使用）
# 生产环境推荐：uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
# Docker 环境 ：见 Dockerfile / docker-compose.yml
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=GATEWAY_HOST,
        port=GATEWAY_PORT,
        reload=False,   # 生产环境不开热重载
        workers=1,
    )


# =============================================================================
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║           SOPHNET_CONTRACT  —  对 Sophnet 上游接口的要求规范              ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# 本网关作为新加坡接入层，Sophnet 需在中国 GPU 集群侧提供以下能力，
# 方可与本网关正常对接。此节作为双方技术对接的最低接口契约。
#
# ─────────────────────────────────────────────────────────────────────────────
# 【1】接口地址
# ─────────────────────────────────────────────────────────────────────────────
#   POST  {SOPHNET_API_URL}/v1/chat/completions   推理（文本 + 多模态）
#   GET   {SOPHNET_API_URL}/v1/models             模型列表
#
#   SOPHNET_API_URL 须为 HTTPS，持有合法 TLS 证书
#   （或双方约定内网自签证书 + 固定 IP 白名单）。
#
# ─────────────────────────────────────────────────────────────────────────────
# 【2】鉴权
# ─────────────────────────────────────────────────────────────────────────────
#   所有请求携带：
#       Authorization: Bearer <SOPHNET_API_KEY>
#
#   Sophnet 需验证此 Key，未授权请求返回 HTTP 401。
#   Key 通过加密渠道（Signal / 加密邮件）交换，禁止明文传输。
#
# ─────────────────────────────────────────────────────────────────────────────
# 【3】POST /v1/chat/completions — 请求格式
# ─────────────────────────────────────────────────────────────────────────────
#   Content-Type: application/json
#
#   必须支持字段：
#       model        string            模型名（如 "qwenvl"）
#       messages     array<Message>    对话历史，每条含 role + content
#       stream       bool              true=SSE 流式，false=完整 JSON
#
#   可选字段（传入时须生效）：
#       temperature  float   0.0 ~ 2.0
#       max_tokens   int     最大生成 token 数
#       top_p        float   0.0 ~ 1.0
#       stop         string | string[]  停止词
#
#   多模态消息示例（Qwen-VL，content 为列表）：
#   {
#     "role": "user",
#     "content": [
#       {"type": "image_url", "image_url": {"url": "https://example.com/img.jpg"}},
#       {"type": "text", "text": "请描述这张图片"}
#     ]
#   }
#
# ─────────────────────────────────────────────────────────────────────────────
# 【4】POST /v1/chat/completions — 响应格式
# ─────────────────────────────────────────────────────────────────────────────
#   非流式（stream=false）完整 JSON：
#   {
#     "id": "chatcmpl-xxx",
#     "object": "chat.completion",
#     "created": 1700000000,
#     "model": "qwenvl",
#     "choices": [{
#       "index": 0,
#       "message": {"role": "assistant", "content": "..."},
#       "finish_reason": "stop"
#     }],
#     "usage": {
#       "prompt_tokens": 10,
#       "completion_tokens": 20,
#       "total_tokens": 30
#     }
#   }
#
#   流式（stream=true）Server-Sent Events 格式，每个数据块：
#       data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"片段"},"finish_reason":null}]}\n\n
#
#   流结束固定发送：
#       data: [DONE]\n\n
#
# ─────────────────────────────────────────────────────────────────────────────
# 【5】GET /v1/models — 响应格式
# ─────────────────────────────────────────────────────────────────────────────
#   {
#     "object": "list",
#     "data": [
#       {
#         "id": "qwenvl",
#         "object": "model",
#         "created": 1700000000,
#         "owned_by": "sophnet"
#       }
#     ]
#   }
#
# ─────────────────────────────────────────────────────────────────────────────
# 【6】错误码规范
# ─────────────────────────────────────────────────────────────────────────────
#   HTTP 状态码  含义
#   401          鉴权失败（Key 错误或缺失）
#   422          请求格式错误（建议附带 OpenAI 风格 error 对象）
#   429          超出配额 / 触发限速（网关透传，客户端收到 429）
#   500          推理内部错误
#   503          GPU 资源暂时不可用（网关透传此状态码）
#
#   建议错误响应体格式（OpenAI 风格）：
#   {"error": {"message": "描述", "type": "错误类型", "code": "错误码"}}
#
# ─────────────────────────────────────────────────────────────────────────────
# 【7】性能 SLA（POC 阶段参考目标）
# ─────────────────────────────────────────────────────────────────────────────
#   指标                目标值
#   文本推理 P99 延迟   ≤ 5s（含跨境网络传输）
#   接口可用性          ≥ 95%
#   POC 并发            ≥ 10 并发请求
#
# ─────────────────────────────────────────────────────────────────────────────
# 【8】Sophnet 需向网关运营方提供的信息
# ─────────────────────────────────────────────────────────────────────────────
#   必须提供：
#     SOPHNET_API_URL    推理入口 HTTPS 地址（写入 .env）
#     SOPHNET_API_KEY    Bearer Token 密钥（写入 .env，禁止明文邮件传输）
#     模型 ID 列表       用于 DEFAULT_MODEL 配置及 /v1/models 验证
#
#   可选提供：
#     非标准请求字段说明（如 Sophnet 私有推理参数）
#     IP 白名单要求（若上游需要固定出口 IP）
#     跨境隧道接入方式（如专线 / VPN 配置）
#     用量日志格式说明（用于 Phase 2 计费对账）
# =============================================================================
