# DCDeepTech AI Infrastructure — Monorepo

Cross-border AI inference platform. Singapore control plane enforces auth, PII detection, policy, and audit before routing inference requests to the Chongqing GPU cluster.

## Structure

```
monorepo-root/
├── front/              # Customer-facing and commercial surfaces
│   └── apps/
│       ├── marketing/  # Public marketing site (Next.js 16)
│       └── portal/     # Customer self-service portal (Next.js 16)
│
├── platform-sg/        # Singapore control plane — regulatory boundary
│   ├── apps/
│   │   └── admin-console/   # Internal operator console (Vite/React 18) — NOT public
│   ├── services/
│   │   ├── gateway/         # FastAPI: auth, PII, policy, routing, audit
│   │   └── compliance/      # FastAPI: DSAR, consent, breach, retention (PDPA)
│   └── packages/
│       └── sg-api-client/   # OpenAPI-generated TS client — only bridge from front/ to platform-sg/
│
├── backend-cq/         # Chongqing execution plane (scaffold — not yet implemented)
│   └── services/
│       ├── vllm-runtime/    # vLLM server config and model registry
│       ├── node-agent/      # GPU node health reporting
│       └── inference-api/   # HTTP endpoint called by SG gateway dispatcher
│
├── shared/             # Cross-layer packages — no deployment surface
│   └── packages/
│       ├── types/           # TypeScript API contract interfaces
│       ├── ui/              # Shared Radix-based UI primitives
│       ├── config-eslint/   # Shared ESLint presets
│       ├── config-typescript/ # Shared tsconfig bases
│       └── config-tailwind/ # Brand design tokens
│
├── docs/               # Architecture, API reference, runbooks
├── scripts/            # Operational scripts (seed-admin-key.py — manual only)
└── .github/workflows/  # CI/CD (plane-scoped — front/SG/CQ deploy independently)
```

## Quick start

```bash
# First time
bash scripts/bootstrap.sh

# Start Singapore control plane
make dev-sg

# Start customer front apps
make dev-front

# Start internal admin console
make dev-admin

# All available targets
make help
```

## Key boundaries

| From | May import | May NOT import |
|---|---|---|
| `front/` | `@shared/*`, `@platform-sg/sg-api-client` | platform-sg source, backend-cq |
| `platform-sg/` | `@shared/*` | front/, backend-cq |
| `backend-cq/` | nothing in monorepo | platform-sg, front, shared |
| `shared/` | nothing | any plane package |

**Admin console** (`platform-sg/apps/admin-console/`) is an internal operator tool. It must be served from an internal origin — never from a public CDN or the same origin as the customer portal.

## Service ports (local)

| Service | Port |
|---|---|
| sg-gateway | 8080 |
| sg-compliance | 8081 |
| admin-console (Vite dev) | 5173 |
| front/marketing | 3000 |
| front/portal | 3001 |
| cq-inference-api | 8090 |

## Gateway request pipeline

Every `POST /v1/chat/completions` passes through in strict order:

```
1. Auth          — validate sk-dcdt-* Bearer key, resolve tenant + scopes
2. PII detect    — classify prompt: PUBLIC / LOW_RISK / PERSONAL / HIGH_RISK
3. Redact        — replace PII tokens with [TYPE] labels if PERSONAL
4. Policy        — PUBLIC/LOW_RISK -> CQ | PERSONAL -> SG | HIGH_RISK -> HTTP 451
5. Dispatch      — forward to SG LiteLLM or CQ vLLM
6. Audit         — write metadata-only JSON record (never raw prompt or PII values)
```

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

## Migration from old layout

| Old path | New path |
|---|---|
| `vllm/src/` | `platform-sg/apps/admin-console/` |
| `vllm/backend/app/` + `gateway/` + `keys/` + `security/` + `audit/` | `platform-sg/services/gateway/` |
| `vllm/backend/compliance/` | `platform-sg/services/compliance/` |
| `vllm/backend/inference/adapters/` | `platform-sg/services/gateway/adapters/` |
| `vllm/backend/config/` | `platform-sg/services/gateway/config/` |
| `vllm/backend/seed_admin_key.py` | `scripts/seed-admin-key.py` |
| `front/marketing/` | `front/apps/marketing/` |
| `front/portal/` | `front/apps/portal/` |
