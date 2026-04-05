"""
cq-inference-api — Chongqing inference API entry point.
PLACEHOLDER — implement when CQ runtime is provisioned.

Receives requests from platform-sg/services/gateway/routing/dispatcher.py.
Proxies to local vLLM runtime (localhost:8000).
"""
from fastapi import FastAPI

app = FastAPI(
    title="cq-inference-api",
    description="Chongqing inference API — OpenAI-compatible endpoint backed by vLLM",
    version="0.1.0",
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cq-inference-api"}


# TODO: implement POST /v1/chat/completions
# See app/routers/completions.py
