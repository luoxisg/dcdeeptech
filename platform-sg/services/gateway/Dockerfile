FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service source
COPY app/ ./app/
COPY auth/ ./auth/
COPY keys/ ./keys/
COPY policy/ ./policy/
COPY routing/ ./routing/
COPY security/ ./security/
COPY audit/ ./audit/
COPY adapters/ ./adapters/
COPY config/ ./config/

# Runtime directories (override with volume mounts in production)
RUN mkdir -p /app/data /app/audit_logs

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
