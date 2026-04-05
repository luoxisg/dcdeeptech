# Local Dev Setup

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 20 | https://nodejs.org |
| pnpm | >= 9 | `npm install -g pnpm` |
| Python | >= 3.11 | https://python.org |
| Docker Desktop | latest | https://docker.com |

## First-time setup

```bash
# 1. Bootstrap everything
bash scripts/bootstrap.sh

# 2. Configure environment variables
cp platform-sg/services/gateway/.env.example platform-sg/services/gateway/.env.local
cp platform-sg/services/compliance/.env.example platform-sg/services/compliance/.env.local
cp platform-sg/apps/admin-console/.env.example platform-sg/apps/admin-console/.env.local
cp front/apps/portal/.env.example front/apps/portal/.env.local
# Edit each .env.local and fill in real values

# 3. Seed the initial admin key (ONCE only)
make seed
# Save the printed key to your password manager immediately
```

## Running the full stack

**Terminal 1 — Singapore control plane (gateway + compliance)**
```bash
make dev-sg
# gateway: http://localhost:8080
# compliance: http://localhost:8081
```

**Terminal 2 — Admin console (internal operator UI)**
```bash
make dev-admin
# http://localhost:5173
```

**Terminal 3 — Customer-facing front apps**
```bash
make dev-front
# marketing: http://localhost:3000
# portal: http://localhost:3001
```

## Running only a specific service

```bash
# Just the gateway
cd platform-sg/services/gateway
uvicorn app.main:app --reload --port 8080

# Just the admin console
cd platform-sg/apps/admin-console
pnpm dev

# Just the marketing site
cd front/apps/marketing
pnpm dev
```

## Running Python tests

```bash
make test-sg
# OR individually:
cd platform-sg/services/gateway && python -m pytest tests/ -v
cd platform-sg/services/compliance && python -m pytest tests/ -v
```

## Running JS tests and checks

```bash
# Build + lint + typecheck all affected packages
pnpm turbo run build lint typecheck

# Build only one package
pnpm turbo run build --filter="@front/app-portal"
```

## Common issues

**`UPSTREAM_API_KEY not set`** — Add to `platform-sg/services/gateway/.env.local`

**`keys.db not found`** — Run `make seed` first

**Admin console shows "demo mode"** — Set `VITE_GATEWAY_URL=http://localhost:8080` in `platform-sg/apps/admin-console/.env.local`

**Portal can't reach gateway** — Ensure gateway is running and `NEXT_PUBLIC_GATEWAY_API_URL` is set in portal's `.env.local`
