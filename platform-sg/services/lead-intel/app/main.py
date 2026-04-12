"""DCDeepTech lead discovery and qualification service."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.leads import router as leads_router
from db.models import seed_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed_data()
    yield


app = FastAPI(
    title="DCDeepTech Lead Intelligence",
    description=(
        "B2B lead discovery platform for China-linked, internationally backed companies "
        "that may need cross-border AI infrastructure, API gatewaying, inference, compliance, "
        "or OCP-based infrastructure."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "lead-intel"}
