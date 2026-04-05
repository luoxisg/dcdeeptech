"""
DCDeepTech AI Gateway — FastAPI application entry point.

Request flow (in order):
  1. require_auth   — validate DCDeepTech API key, resolve tenant + scopes
  2. PII detection  — classify prompt, identify sensitive data
  3. Redaction      — replace PII tokens if required by policy
  4. Policy engine  — allow/deny, choose destination region (SG vs CQ)
  5. Dispatch       — forward to appropriate vLLM / LiteLLM backend
  6. Audit          — write metadata-only audit record (no raw prompt)

Run from the backend/ directory:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import proxy
from keys import admin_routes
from compliance import routes as compliance_routes

# ── Logging setup (JSON-ish structured output) ────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)

# Separate audit logger — writes to audit_logs/ in production
audit_handler = logging.FileHandler(
    os.getenv("AUDIT_LOG_DIR", "audit_logs/") + "audit.jsonl",
    mode="a",
    encoding="utf-8",
)
audit_handler.setFormatter(logging.Formatter("%(message)s"))
logging.getLogger("audit").addHandler(audit_handler)
logging.getLogger("audit").propagate = False


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    logging.getLogger("startup").info("DCDeepTech Gateway starting")
    yield
    logging.getLogger("startup").info("DCDeepTech Gateway stopping")


app = FastAPI(
    title="DCDeepTech AI Gateway",
    description=(
        "Cross-border AI inference gateway.\n"
        "Singapore control plane — policy, auth, audit, redaction.\n"
        "Chongqing inference plane — GPU inference, minimal logging."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(proxy.router, tags=["inference"])
app.include_router(admin_routes.router, prefix="/admin", tags=["admin"])
app.include_router(compliance_routes.router, tags=["compliance"])


@app.get("/health", tags=["system"])
async def health():
    """Liveness probe — no auth required."""
    return {"status": "ok", "service": "dcdt-gateway", "version": "0.1.0"}
