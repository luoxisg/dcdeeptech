# Lead Intelligence MVP Architecture

## Runtime shape

- `apps/web`: Next.js UI
- `apps/api`: FastAPI service
- `packages/ui`, `packages/types`: TypeScript shared packages
- `packages/db`, `packages/scoring`, `packages/llm`, `packages/connectors`: Python domain packages
- PostgreSQL + Redis from `docker-compose.yml`

## Data flow

1. Seeded fixture connector loads demo companies, signals, and funding events.
2. Rule-based scoring computes A/B/C agent scores.
3. LLM contract layer creates concise evidence-backed summaries in mock mode.
4. API serves filtered leads, detail views, watchlist state, and export payloads.
5. Next.js app renders dashboard, search, list, detail, watchlist, and export flows.
