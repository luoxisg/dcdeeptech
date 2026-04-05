# Runbook: API Key Rotation

## When to rotate

- Suspected key compromise
- Employee off-boarding (if employee had access to a key)
- Scheduled rotation policy (recommended: every 90 days for `admin:*` scoped keys)
- After any security incident involving the gateway

## Rotation steps

### 1. Create a new key

```bash
curl -X POST http://localhost:8080/admin/api-keys \
  -H "Authorization: Bearer <current-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant-id>",
    "scopes": ["<same-scopes-as-old-key>"],
    "description": "Rotation — replaced key <old-key-prefix>"
  }'
```

Save the returned `key` field immediately. It is shown only once.

### 2. Update the consuming service

Replace the old key in the consuming service's secrets manager / `.env.production` / k8s secret.

Redeploy or restart the consuming service.

### 3. Verify the new key works

```bash
curl http://localhost:8080/health -H "Authorization: Bearer <new-key>"
```

Expect `{"status": "ok"}`.

### 4. Disable the old key

```bash
curl -X POST http://localhost:8080/admin/api-keys/<old-key-id>/disable \
  -H "Authorization: Bearer <new-admin-key>"
```

Keep the key in `disabled` state for 24 hours. If no issues are reported, proceed to revocation.

### 5. Revoke the old key (irreversible)

```bash
curl -X POST http://localhost:8080/admin/api-keys/<old-key-id>/revoke \
  -H "Authorization: Bearer <new-admin-key>"
```

Revocation is permanent. The key ID and prefix remain in the audit log.

## Emergency rotation (suspected compromise)

If a key is believed to be compromised:
1. **Revoke immediately** (skip the disable step)
2. Review `audit_logs/audit.jsonl` for requests made with the compromised key (`key_prefix` field)
3. If the key had `admin:*` scopes, rotate the `UPSTREAM_API_KEY` too and redeploy gateway
4. File a breach incident in sg-compliance if any PERSONAL or HIGH_RISK data was exposed: `POST /compliance/breach`
