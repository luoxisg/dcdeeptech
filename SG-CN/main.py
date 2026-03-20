from fastapi import FastAPI, Request, HTTPException
import httpx
import os

app = FastAPI()

# ===== 环境变量 =====
SOPHNET_API_URL = os.getenv("SOPHNET_API_URL", "https://your-sophnet-endpoint")
SOPHNET_API_KEY = os.getenv("SOPHNET_API_KEY", "your-key")
GATEWAY_API_KEY = os.getenv("GATEWAY_API_KEY", "sk-demo")

# ===== 健康检查 =====
@app.get("/health")
async def health():
    return {"status": "ok", "service": "dcdeeptech-api"}

# ===== 模型列表 =====
@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "qwen-7b"},
            {"id": "deepseek"}
        ]
    }

# ===== Chat Completion（核心）=====
@app.post("/v1/chat/completions")
async def chat(request: Request):
    # ---------- 鉴权 ----------
    auth = request.headers.get("Authorization")
    if not auth or auth != f"Bearer {GATEWAY_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    body = await request.json()

    # ---------- OpenAI → Sophnet 转换 ----------
    messages = body.get("messages", [])
    prompt = "\n".join([m["content"] for m in messages])

    payload = {
        "prompt": prompt,
        "max_tokens": body.get("max_tokens", 512)
    }

    headers = {
        "Authorization": f"Bearer {SOPHNET_API_KEY}",
        "Content-Type": "application/json"
    }

    # ---------- 调用 Sophnet ----------
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                SOPHNET_API_URL,
                json=payload,
                headers=headers
            )
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    result = resp.json()

    # ---------- Sophnet → OpenAI 转换 ----------
    output_text = result.get("text", "")

    return {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "model": body.get("model", "qwen-7b"),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": output_text
                },
                "finish_reason": "stop"
            }
        ]
    }
