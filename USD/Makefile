.PHONY: setup dev-web dev-api dev-stack seed test build

setup:
	pnpm install

dev-web:
	pnpm --filter @lead-intel/web dev

dev-api:
	python -m uvicorn apps.api.app.main:app --reload --host 0.0.0.0 --port 8000

dev-stack:
	docker compose up -d postgres redis

seed:
	python scripts/seed/seed_lead_intel.py

test:
	python -m pytest tests/unit tests/integration -q

build:
	pnpm --filter @lead-intel/web build
