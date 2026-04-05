/**
 * @platform-sg/sg-api-client
 *
 * Typed HTTP client for the sg-gateway public API.
 * Generated from gateway's OpenAPI spec via `pnpm generate` (openapi-typescript).
 *
 * This is the ONLY sanctioned import path from front/ into platform-sg.
 * front/apps/portal imports from here — never from platform-sg source directly.
 *
 * To regenerate after gateway API changes:
 *   1. Start sg-gateway locally (make dev-sg)
 *   2. Run: pnpm --filter @platform-sg/sg-api-client generate
 *   3. Commit the updated src/generated.d.ts
 */

// Re-export generated types once generated.d.ts exists
// export type * from "./generated.d.ts";

// ── Hand-written baseline types (until first generation run) ─────────────────

export interface ApiKey {
  key_id: string;
  key_prefix: string;
  tenant_id: string;
  scopes: string[];
  status: "active" | "disabled" | "revoked";
  created_at: string;
  expires_at: string | null;
}

export interface CreateKeyRequest {
  tenant_id: string;
  scopes: string[];
  expires_in_days?: number;
}

export interface CreateKeyResponse {
  /** Full key — returned ONCE at creation only. Never stored server-side. */
  key: string;
  key_id: string;
  key_prefix: string;
}

export interface UsageSummary {
  tenant_id: string;
  period_start: string;
  period_end: string;
  total_requests: number;
  total_tokens: number;
  blocked_requests: number;
}

export interface DsarRequest {
  dsar_id: string;
  type: string;
  subject_name: string;
  subject_email: string;
  tenant_id: string;
  status: "pending" | "verifying" | "processing" | "completed" | "rejected";
  submitted_at: string;
  due_at: string;
  resolved_at: string | null;
}

export interface GatewayError {
  detail: string;
  status_code: number;
}

// ── Client factory ────────────────────────────────────────────────────────────

export function createGatewayClient(baseUrl: string, apiKey: string) {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  return {
    async listKeys(tenantId?: string): Promise<ApiKey[]> {
      const url = tenantId
        ? `${baseUrl}/admin/api-keys?tenant_id=${tenantId}`
        : `${baseUrl}/admin/api-keys`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw await res.json() as GatewayError;
      return res.json();
    },

    async createKey(body: CreateKeyRequest): Promise<CreateKeyResponse> {
      const res = await fetch(`${baseUrl}/admin/api-keys`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await res.json() as GatewayError;
      return res.json();
    },

    async revokeKey(keyId: string): Promise<void> {
      const res = await fetch(`${baseUrl}/admin/api-keys/${keyId}/revoke`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw await res.json() as GatewayError;
    },

    async getUsage(tenantId: string, period?: string): Promise<UsageSummary> {
      const url = period
        ? `${baseUrl}/usage/${tenantId}?period=${period}`
        : `${baseUrl}/usage/${tenantId}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw await res.json() as GatewayError;
      return res.json();
    },
  };
}
