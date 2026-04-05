# Runbook: DSAR Handling (Data Subject Access Requests)

## PDPA obligation

Under the Singapore PDPA, organisations must respond to a DSAR within **30 calendar days** of receipt. The sg-compliance service tracks this automatically (`due_at = submitted_at + 30 days`).

## Receiving a DSAR

DSARs arrive via:
1. The customer portal (`front/apps/portal/`) — tenants submit on behalf of their users
2. Email to the designated DPO address — log manually via the compliance API

### Log the DSAR

```bash
curl -X POST http://<compliance>/compliance/dsar \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "access",
    "subject_name": "Jane Doe",
    "subject_email": "jane.doe@example.com",
    "tenant_id": "tenant-abc123",
    "description": "Requesting all personal data held about the subject"
  }'
```

DSAR types: `access` | `correction` | `deletion` | `portability`

### Check all open DSARs

```bash
curl http://<compliance>/compliance/dsar \
  -H "Authorization: Bearer <admin-key>"
```

Watch for DSARs approaching their `due_at` date.

## State machine

```
pending → verifying → processing → completed
    └──────────────→────────────→  rejected
```

Advance via:
```bash
curl -X POST http://<compliance>/compliance/dsar/<dsar-id>/status \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"status": "verifying", "notes": "Identity verification email sent"}'
```

## Processing an access request

1. **Verify identity** — confirm the requester is who they claim to be (government-issued ID or account ownership proof)
2. **Search audit logs** — find all entries where `tenant_id` matches and `prompt_hash` could correlate to the subject
   ```bash
   grep '"tenant_id":"<tenant-id>"' audit_logs/audit.jsonl | jq '{request_id, timestamp, data_class, destination}'
   ```
3. **Search compliance DB** — check consent records and any previous DSARs for the subject email
4. **Compile response** — what data was processed, when, for what purpose, what was retained
5. **Deliver** — send the compiled report to `subject_email` within the 30-day window
6. **Mark completed**
   ```bash
   curl -X POST http://<compliance>/compliance/dsar/<dsar-id>/status \
     -H "Authorization: Bearer <admin-key>" \
     -H "Content-Type: application/json" \
     -d '{"status": "completed", "notes": "Response delivered to subject_email on <date>"}'
   ```

## Processing a deletion request

1. Verify identity
2. Identify all data held: audit log entries (metadata only — no raw prompts stored), consent records, DSAR history
3. Delete or anonymise as appropriate — note that audit log retention policy (`retention_policy.yaml`: 90 days) governs when metadata is purged
4. If the subject is a tenant user, coordinate with the tenant to delete application-level data
5. Mark the DSAR completed with deletion confirmation notes

## Escalation

If a DSAR cannot be fulfilled within 30 days (e.g., complex legal hold), notify the subject before the deadline that an extension is required. Log the extension in the DSAR notes field.
