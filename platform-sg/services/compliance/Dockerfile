FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir "fastapi==0.111.0" "uvicorn[standard]==0.30.1" "pydantic[email]==2.7.4" "python-dotenv>=1.0.1"

COPY app/ ./app/
COPY db/ ./db/

RUN mkdir -p /app/data

EXPOSE 8081

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
