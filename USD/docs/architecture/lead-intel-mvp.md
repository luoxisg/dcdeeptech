# Lead Intelligence MVP Architecture

- `apps/web`: Next.js frontend
- `apps/api`: FastAPI backend
- `packages/scoring`: deterministic A/B/C scoring engine
- `packages/llm`: structured summary generation with mock-first mode
- `packages/connectors`: seeded fixture connector and future live-source abstraction
- `packages/db`: SQLAlchemy models for companies, signals, funding, scores, searches, watchlists, and signal reviews
