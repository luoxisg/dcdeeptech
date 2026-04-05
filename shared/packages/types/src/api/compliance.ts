/**
 * PDPA compliance — HTTP contract types.
 * Describes the wire format of sg-compliance's /compliance endpoints.
 */

export type DsarStatus =
  | "pending"
  | "verifying"
  | "processing"
  | "completed"
  | "rejected";

export type DsarType = "access" | "correction" | "deletion" | "portability";

export interface DsarRequest {
  dsar_id: string;
  type: DsarType;
  subject_name: string;
  subject_email: string;
  tenant_id: string;
  description: string;
  status: DsarStatus;
  submitted_at: string; // ISO 8601
  /** 30 days after submitted_at per PDPA */
  due_at: string;
  resolved_at: string | null;
  notes: string;
}

export interface ConsentRecord {
  record_id: string;
  tenant_id: string;
  subject_email: string;
  purpose: string;
  basis: string;
  granted: boolean;
  granted_at: string;
  withdrawn_at: string | null;
  expires_at: string | null;
}

export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus = "reported" | "investigating" | "contained" | "resolved";

export interface BreachIncident {
  incident_id: string;
  title: string;
  severity: BreachSeverity;
  description: string;
  affected_count: number;
  status: BreachStatus;
  reported_at: string;
  resolved_at: string | null;
}
