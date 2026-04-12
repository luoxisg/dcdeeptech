# China Outbound Enterprise Lead Intelligence Platform

This `USD/` directory now contains a standalone, production-oriented MVP sub-monorepo for:

- Agent A: USD-Funding / VIE Lead Agent
- Agent B: Digital Globalization Lead Agent
- Agent C: Heavy-Asset Global Expansion Lead Agent

## Structure

```text
USD/
  apps/
    web/        # Next.js frontend
    api/        # FastAPI backend
  packages/
    ui/
    types/
    config/
    scoring/
    llm/
    connectors/
    db/
  docs/
  scripts/
  tests/
  package.json
  pnpm-workspace.yaml
  turbo.json
  docker-compose.yml
  .env.example
  Makefile
```

## Run locally

```bash
cd USD
pnpm install
docker compose up -d postgres redis
python scripts/seed/seed_lead_intel.py
python -m uvicorn apps.api.app.main:app --reload --host 0.0.0.0 --port 8000
pnpm --filter @lead-intel/web dev
```

Web:
- `http://localhost:3002`

API:
- `http://localhost:8000`

## Verification

```bash
cd USD
python -m pytest tests/unit tests/integration -q
pnpm --filter @lead-intel/web build
```

## Notes

- Seeded demo data is included for all three agent categories.
- LLM behavior is mock-first and evidence-constrained.
- v1 excludes auto-email, autonomous outreach, and full CRM sync.
