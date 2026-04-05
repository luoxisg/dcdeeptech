# CLAUDE.md — DCDeepTech AI Infrastructure Monorepo

Cross-border AI inference platform. Singapore control plane (auth, PII, policy, audit) routes to Chongqing GPU cluster.

## Tech stack

| Layer | Technology |
|---|---|
| Front apps | Next.js 16, React 19, TypeScript |
| Admin console | Vite 5, React 18, TypeScript |
| SG services | FastAPI, Python 3.11+, Pydantic v2 |
| Package manager | pnpm 9 (workspace), Node >= 20 |
| Build orchestration | Turborepo 2 |
| Python build | hatchling, pytest |

## Common commands

```bash
# First-time setup
bash scripts/bootstrap.sh

# JS deps only
pnpm install

# Python deps
make setup-python-gateway
make setup-python-compliance

# Dev servers
make dev-front        # marketing (3000) + portal (3001)
make dev-admin        # admin-console (5173)
make dev-sg           # gateway (8080) + compliance (8081) via Docker

# Quality
make lint             # ESLint all JS packages
make typecheck        # tsc all TS packages
make test-sg          # pytest platform-sg/services/gateway and compliance

# Build
make build            # all packages
make build-front      # front/ only
make build-sg         # platform-sg/ only

# One-time ops
make seed             # seed initial admin key — run ONCE per env, never automate
make generate-api-client  # regenerate @platform-sg/sg-api-client from OpenAPI spec
```

## Repository layout

```
front/apps/marketing/      Next.js 16 — public marketing site
front/apps/portal/         Next.js 16 — customer self-service portal

platform-sg/apps/admin-console/   Vite/React 18 — INTERNAL operator console
platform-sg/services/gateway/     FastAPI — auth, PII, policy, routing, audit
platform-sg/services/compliance/  FastAPI — DSAR, consent, breach, retention (PDPA)
platform-sg/packages/sg-api-client/  OpenAPI-generated TS client (only bridge front→SG)

backend-cq/services/vllm-runtime/   scaffold only
backend-cq/services/node-agent/     scaffold only
backend-cq/services/inference-api/  scaffold only (called by SG gateway dispatcher)

shared/packages/types/          TS API contract interfaces
shared/packages/ui/             Radix-based UI primitives
shared/packages/config-eslint/  ESLint presets
shared/packages/config-typescript/  tsconfig bases
shared/packages/config-tailwind/   brand design tokens

scripts/bootstrap.sh           first-time setup
scripts/seed-admin-key.py      admin key seeding — manual only
docs/                          architecture, runbooks, API reference
```

## Import boundaries — enforced in CI

| Package | May import | Must NOT import |
|---|---|---|
| `front/` | `@shared/*`, `@platform-sg/sg-api-client` | platform-sg source, backend-cq, other front apps |
| `platform-sg/` | `@shared/*` | front/, backend-cq |
| `backend-cq/` | nothing in monorepo | platform-sg, front, shared |
| `shared/` | nothing | any plane package |

`sg-gateway` and `sg-compliance` must NOT import each other at Python source level. Put shared Python utilities in `platform-sg/packages/sg-common/` if needed.

## Gateway request pipeline

Every `POST /v1/chat/completions` passes through in this exact order:

```
1. Auth         — validate sk-dcdt-* Bearer key, resolve tenant + scopes
2. PII detect   — classify prompt: PUBLIC / LOW_RISK / PERSONAL / HIGH_RISK
3. Redact       — replace PII tokens with [TYPE] labels if PERSONAL
4. Policy       — PUBLIC/LOW_RISK → CQ | PERSONAL → SG | HIGH_RISK → HTTP 451
5. Dispatch     — forward to SG LiteLLM or CQ vLLM
6. Audit        — write metadata-only JSON record (never raw prompt or PII values)
```

Key files: `platform-sg/services/gateway/security/pii/detector.py`, `security/redact/redactor.py`, `policy/engine.py`, `routing/dispatcher.py`, `audit/audit_logger.py`.

Routing rules are in `platform-sg/services/gateway/config/transfer_rules.yaml` — edit the YAML, not the engine code, to change routing policy.

## Service ports (local)

| Service | Port |
|---|---|
| sg-gateway | 8080 |
| sg-compliance | 8081 |
| admin-console (Vite) | 5173 |
| front/marketing | 3000 |
| front/portal | 3001 |
| cq-inference-api | 8090 |

## Environment files

Each service has a `.env.example`. Copy it and fill in real values — never commit `.env` or `.env.local`.

```bash
cp platform-sg/services/gateway/.env.example platform-sg/services/gateway/.env.local
cp platform-sg/services/compliance/.env.example platform-sg/services/compliance/.env.local
# admin-console uses VITE_GATEWAY_URL only
```

Key env vars for gateway: `KEY_DB_PATH`, `AUDIT_LOG_DIR`, `ALLOWED_ORIGINS`, `ADMIN_ALLOWED_CIDRS`, `CQ_VLLM_URL`, `SG_LITELLM_URL`.

## Critical rules

**Admin console deployment**: `platform-sg/apps/admin-console/` must be served from an internal origin. Never deploy it to a public CDN (Vercel, Cloudflare Pages, Netlify), never serve it from the same origin as `front/apps/portal/`. Exposing it publicly means the key revocation UI and audit logs are reachable from the internet.

**Audit logs**: The audit logger must write metadata only — never the raw prompt, completion, or any PII values. If you touch `audit/audit_logger.py`, verify no prompt content is logged.

**Dispatcher lives in SG**: `routing/dispatcher.py` and `adapters/openai_compatible.py` call CQ but run and are deployed in Singapore. Do not move them to `backend-cq/`.

**seed-admin-key.py**: Runs once per environment. Do not automate it, do not add it to CI, do not call it idempotently.

**backend-cq is scaffold**: All three `backend-cq/services/*/PLACEHOLDER.md` services are not yet implemented. Do not add business logic there unless implementing the CQ plane intentionally.

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [Trust zones and boundary rules](docs/architecture/trust-zones.md)
- [PDPA compliance posture](docs/compliance/pdpa-posture.md)
- [Subprocessor registry](docs/compliance/subprocessor-registry.md)
- [Local dev setup](docs/runbooks/local-dev-setup.md)
- [Key rotation](docs/runbooks/key-rotation.md)
- [Breach response](docs/runbooks/breach-response.md)
- [DSAR handling](docs/runbooks/dsar-handling.md)
- [API reference](docs/api/index.html)
