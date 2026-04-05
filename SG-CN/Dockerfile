# ============================================================
# DCDeepTech AI Gateway — Dockerfile
# Singapore deployment · Python 3.12 slim base
# ============================================================

FROM python:3.12-slim

# Metadata
LABEL maintainer="DCDeepTech" \
      description="OpenAI-compatible Singapore AI Gateway" \
      domain="api.dcdeeptech.com"

# System deps (none needed beyond pip) — keep image lean
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (layer-cached until requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY main.py config.py auth.py models.py adapters.py ./
COPY routes/ routes/
COPY utils/ utils/

# Expose the gateway port
EXPOSE 8000

# Run with uvicorn — workers=1 is intentional: the app is async, and
# multiple workers would each maintain their own httpx client pool.
# Scale horizontally at the container / k8s level instead.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
