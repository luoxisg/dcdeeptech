from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import export, leads, searches, signals, watchlist
from .core.config import settings
from .core.logging import configure_logging
from .db.bootstrap import seed_demo_data
from .db.session import SessionLocal, engine
from packages.db.models import Base


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(watchlist.router, prefix="/api")
app.include_router(searches.router, prefix="/api")
app.include_router(signals.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "China Outbound Enterprise Lead Intelligence Platform API",
        "version": "0.1.0",
        "status": "ok",
        "docs_url": "/docs",
        "health_url": "/health",
        "sample_endpoints": [
            "/api/leads",
            "/api/watchlist",
            "/api/searches",
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "lead-intel-api"}
