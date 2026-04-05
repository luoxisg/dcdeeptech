#!/usr/bin/env bash
# bootstrap.sh — first-time environment setup for the DCDeepTech monorepo
set -euo pipefail

echo "==> Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "ERROR: node not found. Install Node.js >= 20"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm not found. Run: npm install -g pnpm"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found. Install Python >= 3.11"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "WARNING: docker not found. Required for make dev-sg"; }

echo "==> Installing JS workspace dependencies..."
pnpm install

echo "==> Installing Python deps for sg-gateway..."
(cd platform-sg/services/gateway && pip install -r requirements.txt)

echo "==> Installing Python deps for sg-compliance..."
(cd platform-sg/services/compliance && pip install fastapi==0.111.0 uvicorn python-dotenv pydantic)

echo ""
echo "==> Bootstrap complete. Next steps:"
echo ""
echo "  1. Copy .env.example files and fill in real values:"
echo "     cp platform-sg/services/gateway/.env.example platform-sg/services/gateway/.env.local"
echo "     cp platform-sg/services/compliance/.env.example platform-sg/services/compliance/.env.local"
echo ""
echo "  2. Seed the admin key (ONCE per environment):"
echo "     make seed"
echo ""
echo "  3. Start the Singapore control plane:"
echo "     make dev-sg"
echo ""
echo "  4. Start the customer-facing front apps:"
echo "     make dev-front"
echo ""
