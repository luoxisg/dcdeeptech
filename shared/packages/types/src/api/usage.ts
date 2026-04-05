/**
 * Usage and metering — HTTP contract types.
 * Describes the wire format of sg-gateway's /usage endpoints.
 */

export interface UsageSummary {
  tenant_id: string;
  period_start: string; // ISO 8601
  period_end: string;
  total_requests: number;
  successful_requests: number;
  blocked_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  /** Breakdown by destination region */
  by_region: {
    sg: number;
    cq: number;
  };
  /** Breakdown by data class */
  by_data_class: {
    PUBLIC: number;
    LOW_RISK: number;
    PERSONAL: number;
    HIGH_RISK: number;
  };
}

export interface UsageRecord {
  request_id: string;
  tenant_id: string;
  key_id: string;
  timestamp: string;
  data_class: "PUBLIC" | "LOW_RISK" | "PERSONAL" | "HIGH_RISK";
  destination: "sg" | "cq" | "blocked";
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
}

export type BillingPeriod = "current" | "last_30d" | "last_7d";
