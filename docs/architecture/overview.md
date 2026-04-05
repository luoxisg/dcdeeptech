# Architecture Overview

## System Purpose

DCDeepTech operates a cross-border AI inference service that allows Singapore-registered tenants to use GPU inference capacity in Chongqing. The regulatory requirement is that all personal data is detected, classified, and either redacted or blocked before any data crosses from Singapore to Chongqing.

## Three Planes

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONT (customer browser / public internet)                     │
│  front/apps/marketing   front/apps/portal                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ public HTTPS API (versioned)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PLATFORM-SG (Singapore control plane)                          │
│  ┌─────────────────────────────────────┐  ┌──────────────────┐  │
│  │  sg-gateway (FastAPI)               │  │  sg-compliance   │  │
│  │  auth → PII detect → redact →       │  │  (PDPA, DSAR,    │  │
│  │  policy → dispatch → audit          │  │  consent, breach)│  │
│  └──────────────────┬──────────────────┘  └──────────────────┘  │
│  ┌──────────────────┴──────────────────┐                        │
│  │  admin-console (Vite/React, INTERNAL│                        │
│  │  ONLY — operator tool)              │                        │
│  └─────────────────────────────────────┘                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ internal mTLS / VPN
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND-CQ (Chongqing execution plane)                         │
│  cq-inference-api  →  vLLM runtime  ←  node-agent (GPU health) │
└─────────────────────────────────────────────────────────────────┘
```

## Trust Zones

| Zone | Trust | Internet-facing | Contains PII? |
|---|---|---|---|
| `front/` | Untrusted (customer) | Yes | No (form inputs only, no storage) |
| `platform-sg/` | Trusted (Singapore) | Gateway only | Yes (temporarily, then redacted) |
| `backend-cq/` | Trusted (CQ internal) | No | After policy: only redacted or public data |

## Gateway 5-Step Pipeline

Every request to `POST /v1/chat/completions` passes through this pipeline in strict order. The order is immutable.

```
1. require_auth
   Validates sk-dcdt-* Bearer token.
   Returns: tenant_ctx (tenant_id, scopes, key_id, key_prefix)

2. PiiDetector.detect()
   Runs 8 regex patterns against the prompt.
   Returns: PiiDetectionResult (data_class, findings, prompt_hash)
   Data classes: PUBLIC < LOW_RISK < PERSONAL < HIGH_RISK

3. Redactor.redact()
   If data_class >= PERSONAL, replaces PII findings with [TYPE] labels.
   Position-based reverse-order replacement — no offset drift.
   Original values never logged.

4. PolicyEngine.evaluate()
   Reads transfer_rules.yaml. Top-down rule matching by data_class.
   PUBLIC/LOW_RISK → allow, destination: cq
   PERSONAL        → allow, destination: sg (redacted), requires_redaction: true
   HIGH_RISK       → deny (HTTP 451)

5. Dispatcher.dispatch() + AuditLogger.log()
   Injects internal UPSTREAM_API_KEY (never from client).
   Routes to SG LiteLLM or CQ vLLM based on policy decision.
   Audit writes metadata-only JSON line (never raw prompt or PII values).
```

## API Key System

- Format: `sk-dcdt-<32 random bytes hex>`
- Key ID: `kdcdt_<8 random bytes hex>`
- Storage: PBKDF2-HMAC-SHA256 with 260,000 iterations (OWASP 2024 minimum)
- Full key returned **once only** at creation — cannot be recovered
- Prefix (`sk-dcdt-XXXXXXXXXXXXXXXX...`) stored for display
- State machine: `active ↔ disabled → revoked` (revoked is terminal)
- Scopes: `chat:completions`, `admin:keys`, `admin:tenants`, `internal:routing`

## Data Flow Diagram

```
Customer → [front/apps/portal] → @platform-sg/sg-api-client → sg-gateway
                                                                     │
                                                              PII detect
                                                                     │
                                                              Redact if PERSONAL
                                                                     │
                                                              Policy eval
                                                              ┌──────┴───────┐
                                                           DENY        ALLOW
                                                         HTTP 451    ┌──┴──┐
                                                                     SG   CQ
                                                                LiteLLM  vLLM
                                                                     │
                                                              Audit log (metadata only)
                                                                     │
                                                              Response → customer
```

## Monorepo Structure

```
monorepo-root/
├── front/                  # customer browser surfaces
├── platform-sg/            # Singapore control plane
├── backend-cq/             # Chongqing execution plane
├── shared/                 # cross-layer packages (no deployment)
├── docs/                   # this directory
├── scripts/                # operational scripts
└── .github/workflows/      # CI/CD (plane-scoped)
```

See `docs/runbooks/local-dev-setup.md` for developer setup instructions.
