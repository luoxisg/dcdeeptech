.PHONY: setup dev-front dev-sg dev-all seed test-sg lint build clean help

# ── Setup ──────────────────────────────────────────────────────────────────────

setup: ## Install all JS dependencies via pnpm
	pnpm install

setup-python-gateway: ## Install Python deps for platform-sg/services/gateway
	cd platform-sg/services/gateway && pip install -r requirements.txt

setup-python-compliance: ## Install Python deps for platform-sg/services/compliance
	cd platform-sg/services/compliance && pip install -r requirements.txt

# ── Dev ────────────────────────────────────────────────────────────────────────

dev-front: ## Start both front/apps in parallel (marketing + portal)
	pnpm turbo run dev --filter="@front/*"

dev-admin: ## Start platform-sg admin console (Vite)
	pnpm turbo run dev --filter="@platform-sg/app-admin-console"

dev-sg: ## Start Singapore services (gateway + compliance) via docker-compose
	docker compose -f platform-sg/deploy/docker-compose.yml up

dev-all: ## Start everything (front + platform-sg docker services) in parallel
	$(MAKE) dev-sg &
	$(MAKE) dev-front

# ── One-time Ops ───────────────────────────────────────────────────────────────

seed: ## Seed initial admin key (run ONCE per environment — do NOT automate)
	@echo "WARNING: This creates the initial admin key. Run once per environment only."
	@read -p "Target environment (local/staging/production): " env; \
	cd platform-sg/services/gateway && python ../../scripts/seed-admin-key.py --env $$env

# ── Quality ────────────────────────────────────────────────────────────────────

lint: ## Lint all JS packages
	pnpm turbo run lint

typecheck: ## Type-check all TS packages
	pnpm turbo run typecheck

test-sg: ## Run Python tests for platform-sg services
	cd platform-sg/services/gateway && python -m pytest tests/ -v
	cd platform-sg/services/compliance && python -m pytest tests/ -v

# ── Build ──────────────────────────────────────────────────────────────────────

build: ## Build all packages
	pnpm turbo run build

build-front: ## Build only front apps
	pnpm turbo run build --filter="@front/*"

build-sg: ## Build only platform-sg apps/packages
	pnpm turbo run build --filter="@platform-sg/*"

# ── Clean ──────────────────────────────────────────────────────────────────────

clean: ## Remove all build artifacts and node_modules
	pnpm turbo run clean
	find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true

# ── Docs ───────────────────────────────────────────────────────────────────────

generate-api-client: ## Regenerate @platform-sg/sg-api-client from gateway OpenAPI spec
	pnpm turbo run generate --filter="@platform-sg/sg-api-client"

# ── Help ───────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
