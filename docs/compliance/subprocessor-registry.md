# Subprocessor Registry

This registry mirrors `platform-sg/services/gateway/config/subprocessor_allowlist.yaml`. It is the human-readable version for DPO and legal review.

Any change to the allowlist YAML must be accompanied by an update to this document and DPO sign-off.

## Approved Subprocessors

### sg-litellm

| Field | Value |
|---|---|
| Name | Singapore LiteLLM Proxy |
| Purpose | Routes PERSONAL data class inference requests within Singapore |
| Location | Singapore (same jurisdiction as control plane) |
| Data received | Redacted prompts only (PII replaced with `[TYPE]` labels) |
| Cross-border? | No |
| Approved | Yes |
| Approved date | TBD — update on first production deployment |
| DPO sign-off | Required before production use |

### cq-vllm

| Field | Value |
|---|---|
| Name | Chongqing vLLM Inference Cluster |
| Purpose | GPU inference for PUBLIC and LOW_RISK data class requests |
| Location | Chongqing, China |
| Data received | PUBLIC and LOW_RISK prompts only — PERSONAL data never forwarded here |
| Cross-border? | Yes (Singapore → China) |
| Approved | Yes (conditional on policy enforcement being active) |
| Approved date | TBD — update on first production deployment |
| DPO sign-off | Required before production use |
| Conditions | Policy engine must be running and enforcing transfer_rules.yaml at all times |

## Pending Approval

### openai-via-sg

| Field | Value |
|---|---|
| Name | OpenAI API via Singapore proxy |
| Purpose | Fallback/supplementary inference |
| Location | OpenAI infrastructure (US) |
| Data received | TBD |
| Cross-border? | Yes (Singapore → United States) |
| Approved | **No** |
| Status | Pending legal and DPO review |
| Blocker | Standard contractual clauses not yet executed; data residency guarantees not confirmed |

**Action required:** Do not enable this subprocessor in `subprocessor_allowlist.yaml` until legal review is complete.

## Change process

1. Identify the proposed subprocessor
2. Complete a Data Protection Impact Assessment (DPIA)
3. Review contractual terms (DPA, SCCs if applicable)
4. DPO sign-off
5. Update `subprocessor_allowlist.yaml` (set `approved: true`)
6. Update this document
7. Commit both changes in the same PR with DPO approval as a PR review

## Review cadence

This registry is reviewed every 6 months or when a new subprocessor is proposed.
