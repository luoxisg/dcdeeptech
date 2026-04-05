# platform-sg — Singapore Control Plane

This folder owns the Singapore regulatory perimeter end to end.

## What lives here

| Path | Description |
|---|---|
| `apps/admin-console/` | React 18 + Vite SPA — internal operator console (GPU nodes, API keys, audit, PDPA) |
| `services/gateway/` | FastAPI gateway — auth, PII detection, policy engine, routing, audit logging |
| `services/compliance/` | FastAPI PDPA compliance service — DSAR, consent, breach, retention |
| `packages/sg-api-client/` | OpenAPI-generated typed TS client — consumed by `front/apps/portal/` only |
| `deploy/` | docker-compose and k8s manifests for running the full SG control plane |

## Boundary rules

- `front/apps/portal/` may only call platform-sg via `@platform-sg/sg-api-client`. No direct source imports.
- `platform-sg/` does NOT import from `front/` or `backend-cq/`.
- `services/gateway/` and `services/compliance/` are independently deployable Python services with their own `pyproject.toml`. They do not import from each other at the source level.
- `apps/admin-console/` is an INTERNAL OPERATOR TOOL. It must not be deployed to a public CDN or behind the same origin as the customer portal.

## Local development

```bash
# Start gateway + compliance via docker-compose
make dev-sg

# Start admin console (Vite dev server)
make dev-admin

# Seed initial admin key (run once per environment)
make seed
```

## Service ports (local)

| Service | Port |
|---|---|
| sg-gateway | 8080 |
| sg-compliance | 8081 |
| admin-console | 5173 |
