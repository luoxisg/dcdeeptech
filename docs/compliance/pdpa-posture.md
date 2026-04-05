# PDPA Compliance Posture

## Scope

This document describes how DCDeepTech's Singapore control plane addresses Singapore PDPA obligations for cross-border AI inference.

## Data minimisation

- Raw prompt content is **never logged**. Only metadata is written to `audit.jsonl`: `request_id`, `tenant_id`, `key_id`, `key_prefix`, `data_class`, `destination`, `timestamp`, `prompt_hash`
- PII findings (regex match offsets and types) are never logged — only the aggregate `data_class` classification
- `prompt_hash` (SHA-256 of original prompt) is logged for correlation purposes only — it cannot be reversed to recover the original prompt

## Cross-border transfer controls

Governed by `backend/config/transfer_rules.yaml`:

| Data class | Transfer allowed | Destination | Redaction required |
|---|---|---|---|
| PUBLIC | Yes | Chongqing (CQ) | No |
| LOW_RISK | Yes | Chongqing (CQ) | No |
| PERSONAL | Yes | Singapore (SG) LiteLLM only | Yes — PII replaced with `[TYPE]` labels before dispatch |
| HIGH_RISK | **No** | Blocked (HTTP 451) | N/A |

PERSONAL data sent to CQ is prohibited by policy. The policy engine evaluates this before every request. The decision is audited.

## Consent

Consent records are tracked in `sg-compliance` (`/compliance/consent`). Each record captures: tenant, subject email, purpose, legal basis, grant timestamp, withdrawal timestamp, and expiry.

## Data retention

Governed by `backend/config/retention_policy.yaml`:

| Data type | Retention period |
|---|---|
| Audit metadata (audit.jsonl) | 90 days |
| Inference cache (CQ-side) | 72 hours |
| API key records | Indefinite (until revoked + 1 year) |
| Incident logs | 365 days |
| DSAR records | 5 years (regulatory requirement) |
| Consent records | Until withdrawal + 1 year |

## Subprocessor controls

Approved subprocessors are listed in `backend/config/subprocessor_allowlist.yaml`. Any new subprocessor requires explicit approval (`approved: true`) before it can receive data. The dispatcher will not forward to a subprocessor not on the allowlist.

Current approved subprocessors:
- `sg-litellm` — Singapore LiteLLM proxy (PERSONAL data)
- `cq-vllm` — Chongqing vLLM cluster (PUBLIC and LOW_RISK data only, after policy check)

Pending approval:
- `openai-via-sg` — not approved; must not be used until DPO and legal review complete

## DSAR process

See `docs/runbooks/dsar-handling.md`. 30-day SLA enforced by `sg-compliance`.

## Breach notification

See `docs/runbooks/breach-response.md`. PDPC notification within 3 calendar days if notifiable.

## Security controls for personal data

- API keys hashed with PBKDF2-HMAC-SHA256 (260,000 iterations) — never stored plaintext
- Audit logs contain no raw prompts, no PII values, no full API keys
- Admin console is deployed to an internal origin (not a public CDN)
- ADMIN_ALLOWED_CIDRS env var restricts admin endpoint access by IP
- All database files (keys.db, compliance.db) are gitignored and volume-mounted in production

## Gap register

| Gap | Status | Owner |
|---|---|---|
| PostgreSQL migration (replace SQLite for HA) | Not started | Platform SG |
| Per-key rate limiting (Redis sliding window) | Not started | Platform SG |
| MFA enforcement for admin keys | Not started | Platform SG |
| OpenTelemetry cross-border tracing | Not started | Platform SG + CQ |
| SSE streaming support | Not started | Platform SG |
