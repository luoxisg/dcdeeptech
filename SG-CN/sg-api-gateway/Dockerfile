FROM python:3.12-slim-bookworm AS base

# 安全：不以 root 运行
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home appuser

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── 依赖安装层（缓存友好）─────────────────────────────────────────
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── 最终镜像 ──────────────────────────────────────────────────────
FROM deps AS final

# 日志目录
RUN mkdir -p /var/log/sg-gateway && \
    chown -R appuser:appgroup /var/log/sg-gateway

COPY --chown=appuser:appgroup app/ ./app/

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:8000/health/live || exit 1

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "h11", \
     "--log-level", "warning", \
     "--access-log", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
