"""
sg-compliance — PDPA compliance service entry point.

Runs independently from sg-gateway. Mounts:
  /compliance/dsar
  /compliance/consent
  /compliance/retention
  /compliance/breach
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import dsar, consent, retention, breach

app = FastAPI(
    title="sg-compliance",
    description="Singapore PDPA compliance service — DSAR, consent, breach, retention",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dsar.router)
app.include_router(consent.router)
app.include_router(retention.router)
app.include_router(breach.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "sg-compliance"}
