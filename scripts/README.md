# scripts/

Operational scripts that do not belong inside any service.

| Script | Purpose | Run frequency |
|---|---|---|
| `seed-admin-key.py` | Bootstrap the first admin API key for a new environment | **Once per environment — never automate** |
| `bootstrap.sh` | Full environment setup (install deps, create dirs, check prerequisites) | Once per developer machine or CI environment setup |

## seed-admin-key.py

Creates the initial `dcdt-admin` API key with full admin scopes.

**Never add this to a CI/CD pipeline.**

```bash
# From monorepo root:
make seed
```

Output includes the full key (shown once), key ID, and the env var line to add to `.env.local`.

## bootstrap.sh

```bash
bash scripts/bootstrap.sh
```

Runs `pnpm install`, checks Python version, and prints next-step instructions.
