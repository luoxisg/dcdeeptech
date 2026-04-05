/**
 * API key management — HTTP contract types.
 * These describe the wire format of sg-gateway's /admin/api-keys endpoints.
 * They are NOT internal data models.
 */

export type KeyStatus = "active" | "disabled" | "revoked";

export type KeyScope =
  | "chat:completions"
  | "admin:keys"
  | "admin:tenants"
  | "internal:routing";

export interface ApiKey {
  key_id: string;
  /** First 16 characters of the key followed by "..." — safe to display */
  key_prefix: string;
  tenant_id: string;
  scopes: KeyScope[];
  status: KeyStatus;
  created_at: string; // ISO 8601
  expires_at: string | null;
}

export interface CreateKeyRequest {
  tenant_id: string;
  scopes: KeyScope[];
  expires_in_days?: number;
  description?: string;
}

export interface CreateKeyResponse {
  /**
   * The full API key — returned EXACTLY ONCE at creation.
   * Display it to the user immediately; it cannot be retrieved again.
   */
  key: string;
  key_id: string;
  key_prefix: string;
  tenant_id: string;
  scopes: KeyScope[];
  created_at: string;
  expires_at: string | null;
}
