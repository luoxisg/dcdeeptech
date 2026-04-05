# Runbook: Breach Response

## PDPA obligations

Under the Singapore PDPA, a notifiable data breach must be reported to the PDPC within **3 calendar days** of assessment. Affected individuals must be notified as soon as practicable.

A breach is notifiable if it involves personal data **and** is likely to result in significant harm to affected individuals.

## Step 1 — Detect and contain (Day 0)

**Indicators of a breach:**
- Unusual volume of requests from a single key in audit logs
- `HIGH_RISK` data_class appears in audit log (should always be `blocked` — if it isn't, something is wrong)
- Compromised API key reported by a tenant
- Unexpected access to `audit_logs/audit.jsonl`
- Database file exfiltration alert

**Immediate containment actions:**
```bash
# Disable the compromised key immediately
curl -X POST http://<gateway>/admin/api-keys/<key-id>/disable \
  -H "Authorization: Bearer <admin-key>"

# If admin key is compromised — rotate UPSTREAM_API_KEY and redeploy gateway
# (see docs/runbooks/key-rotation.md)
```

## Step 2 — Assess severity (Day 0–1)

Review `audit_logs/audit.jsonl` for the affected time window:

```bash
# Find all requests by the compromised key
grep '"key_prefix":"sk-dcdt-XXXXXXXX"' audit_logs/audit.jsonl | jq .

# Check data classes in the window
grep '"data_class"' audit_logs/audit.jsonl | grep -v '"PUBLIC"\|"LOW_RISK"'
```

Key questions:
- Was PERSONAL data dispatched? (data_class: PERSONAL, destination: sg)
- Was redaction applied? (requires_redaction: true in policy decision)
- Was any HIGH_RISK data dispatched? (should be impossible — policy denies it)
- How many tenants and subjects were potentially affected?

## Step 3 — Log the incident in sg-compliance

```bash
curl -X POST http://<compliance>/compliance/breach \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Suspected data breach — key <key-prefix> compromised",
    "severity": "high",
    "description": "Describe what was accessed, when, and estimated affected count",
    "affected_count": 0
  }'
```

Advance the status as the investigation progresses:
```bash
# pending → investigating → contained → resolved
curl -X POST http://<compliance>/compliance/breach/<incident-id>/advance \
  -H "Authorization: Bearer <admin-key>"
```

## Step 4 — Notify PDPC (Day 0–3 if notifiable)

The DPO (Data Protection Officer) must assess whether the breach is notifiable. If yes:
- File via the PDPC's Breach Notification Portal within 3 calendar days
- Prepare: nature of breach, categories of personal data, approximate number of affected individuals, likely consequences, measures taken

## Step 5 — Notify affected individuals

If significant harm is likely, notify affected tenants and (where known) data subjects. The sg-compliance DSAR module tracks subject emails for this purpose.

## Step 6 — Post-incident review

Within 14 days of containment:
1. Document root cause in the breach incident record (notes field)
2. Update `transfer_rules.yaml` or `api_key_policy.yaml` if policy gaps were identified
3. Review whether additional regex patterns are needed in `security/pii/detector.py`
4. Update `subprocessor_allowlist.yaml` if a subprocessor was involved
5. Advance breach status to `resolved`
