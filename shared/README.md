# shared/ — Cross-Layer Packages

Contains artifacts consumed across the `front/` ↔ `platform-sg/` boundary, with no deployment surface of their own.

## Packages

| Package | Consumed by | Description |
|---|---|---|
| `@shared/types` | `front/apps/portal`, `@platform-sg/sg-api-client` | TypeScript interfaces for gateway/compliance HTTP API contracts |
| `@shared/ui` | `front/apps/marketing`, `front/apps/portal` | Shared Radix-based UI primitives |
| `@shared/config-eslint` | All JS/TS packages | ESLint config presets (base, next, react) |
| `@shared/config-typescript` | All TS packages | tsconfig base files (base, nextjs, react-library) |
| `@shared/config-tailwind` | `front/apps/marketing`, `front/apps/portal` | Brand color tokens, typography, spacing |

## Rules

**Two-consumer rule:** Nothing enters `shared/` unless consumed by packages in two different top-level planes.

**No-business-logic rule:** `shared/` contains only type definitions and config presets. No functions that depend on business rules, no runtime state, no API calls.

**No imports from plane packages:** `shared/` must never import from `front/`, `platform-sg/`, or `backend-cq/`.

**Admin console is NOT a consumer:** `platform-sg/apps/admin-console` uses its own Tailwind config and its own component library. Operator UI should not be coupled to the customer design system.

## Adding to shared/

Before adding a new package:
1. Confirm it is already needed by packages in two different top-level planes
2. Confirm it has no business logic tied to one plane
3. Confirm it has no deployment artifact of its own
