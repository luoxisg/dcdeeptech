"""
SG-CN AI Gateway · 最小 MVP
用法：
    pip install fastapi uvicorn httpx python-dotenv
    uvicorn mvp:app --port 8000
"""

import os, time, uuid, httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse

load_dotenv()

# ── 配置（填入 .env 或直接改这里）────────────────────────────────────────────
GW_KEY      = os.environ["GATEWAY_API_KEY"]          # 对外的 Bearer Token
UP_URL      = os.environ["SOPHNET_API_URL"].rstrip("/")  # Sophnet 推理地址
UP_KEY      = os.environ["SOPHNET_API_KEY"]          # Sophnet 密钥
TIMEOUT     = float(os.getenv("REQUEST_TIMEOUT", "60"))
# ─────────────────────────────────────────────────────────────────────────────

app    = FastAPI(title="SG-CN MVP Gateway")
client = httpx.AsyncClient(timeout=TIMEOUT)          # 全局连接池


def _auth(req: Request):
    """验证客户端 Bearer Token，不通过直接 401。"""
    token = req.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if token != GW_KEY:
        raise HTTPException(401, "Invalid API key")


@app.get("/health")
async def health():
    return {"status": "ok", "ts": int(time.time())}


@app.post("/v1/chat/completions")
async def chat(req: Request):
    _auth(req)
    body    = await req.json()
    stream  = body.get("stream", False)
    headers = {"Authorization": f"Bearer {UP_KEY}", "Content-Type": "application/json"}

    # ── 流式 ──────────────────────────────────────────────────────────────────
    if stream:
        async def gen():
            async with client.stream("POST", f"{UP_URL}/v1/chat/completions",
                                     json=body, headers=headers) as r:
                async for chunk in r.aiter_bytes():
                    yield chunk
        return StreamingResponse(gen(), media_type="text/event-stream")

    # ── 非流式 ────────────────────────────────────────────────────────────────
    r = await client.post(f"{UP_URL}/v1/chat/completions", json=body, headers=headers)
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text)

    resp = r.json()
    resp.setdefault("id",      f"chatcmpl-{uuid.uuid4().hex}")
    resp.setdefault("object",  "chat.completion")
    resp.setdefault("created", int(time.time()))
    return JSONResponse(resp)
