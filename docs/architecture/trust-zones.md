# Trust Zones and Boundary Rules

## Why boundaries matter

The monorepo has three deployment planes with fundamentally different regulatory obligations, network environments, and operator teams. Code boundaries exist to make these deployment boundaries enforceable and obvious.

## Boundary rules (enforced in CI via eslint-plugin-boundaries)

### `front/` imports
- MAY import from: `@shared/*`, `@platform-sg/sg-api-client`
- MAY NOT import from: `platform-sg/` source directly, `backend-cq/`, other `front/` apps

### `platform-sg/` imports
- MAY import from: `@shared/*`
- MAY NOT import from: `front/`, `backend-cq/`
- `sg-gateway` and `sg-compliance` MAY NOT import from each other at the Python source level. Extract shared utilities to `platform-sg/packages/sg-common/` if needed.

### `backend-cq/` imports
- MAY import from: nothing in the monorepo (it is the terminal dependency)
- MAY NOT import from: `platform-sg/`, `front/`, `shared/`

### `shared/` imports
- MAY NOT import from: `front/`, `platform-sg/`, `backend-cq/`

## Admin console deployment boundary

`platform-sg/apps/admin-console/` must be served from an internal origin. It must NOT be:
- Deployed to a public CDN (Vercel, Cloudflare Pages, Netlify with public access)
- Served from the same origin as `front/apps/portal/`
- Accessible without operator SSO or IP allowlisting

Violating this means the operator console (which can revoke all API keys and view audit logs) is reachable from the public internet.

## The `dispatcher.py` and `openai_compatible.py` rule

These files live in `platform-sg/services/gateway/routing/` and `platform-sg/services/gateway/adapters/` respectively. They communicate with CQ but they **run in Singapore**. Moving them to `backend-cq/` would:
1. Create a dependency from SG code into CQ code (wrong direction)
2. Require CQ to be online for SG to build or test
3. Make it unclear who owns the dispatch logic

Rule: code lives where it **runs and is deployed**, not where it **calls to**.
