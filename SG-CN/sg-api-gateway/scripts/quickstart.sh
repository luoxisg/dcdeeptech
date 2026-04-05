#!/usr/bin/env bash
# ============================================================
# 快速启动脚本
# 1. 生成自签名 TLS 证书（开发用）
# 2. 初始化 .env
# 3. 启动 Docker Compose 服务栈
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════════════"
echo "  新加坡算力 API 中台 - 快速启动"
echo "═══════════════════════════════════════════════════"

# ── 1. 检查依赖 ────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not found"; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "❌ OpenSSL not found"; exit 1; }

# ── 2. 生成自签名证书（如果不存在）────────────────────────
mkdir -p certs
if [ ! -f certs/server.crt ]; then
    echo "🔐 Generating self-signed TLS certificate..."
    openssl req -x509 -nodes -newkey rsa:4096 \
        -keyout certs/server.key \
        -out certs/server.crt \
        -days 365 \
        -subj "/C=SG/ST=Singapore/L=Singapore/O=SG-API-Gateway/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
        2>/dev/null
    echo "   ✓ Certificates generated in ./certs/"
else
    echo "   ✓ Certificates already exist"
fi

# ── 3. 初始化 .env（如果不存在）───────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    # 生成随机 Admin Key
    ADMIN_KEY="sgadmin_$(openssl rand -hex 24)"
    REDIS_PASS="redis_$(openssl rand -hex 16)"
    sed -i "s/CHANGE_ME_IN_PRODUCTION_USE_32CHARS_RANDOM_STRING/${ADMIN_KEY}/" .env
    sed -i "s/changeme_redis_pass_32chars_min/${REDIS_PASS}/g" .env
    echo "   ✓ .env created"
    echo ""
    echo "   ⚠️  SAVE YOUR ADMIN API KEY:"
    echo "   Admin Key: ${ADMIN_KEY}"
    echo ""
else
    echo "   ✓ .env already exists"
fi

# ── 4. 启动服务 ────────────────────────────────────────────
echo "🚀 Starting services..."
docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Services started!"
echo ""
echo "  Health:  https://localhost/health"
echo "  Docs:    http://localhost:8000/docs  (dev only)"
echo "  Metrics: http://localhost:8000/internal/metrics"
echo ""
echo "  Quick test:"
echo "  curl -sk https://localhost/health | python3 -m json.tool"
echo "═══════════════════════════════════════════════════"
