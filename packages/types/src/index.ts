export type AgentType = "vie_usd" | "digital_global" | "heavy_asset_global";
export type PriorityTier = "P1" | "P2" | "P3" | "Reject";
export type ReviewStatus = "valid" | "weak" | null;

export interface CompanySummary {
  company_id: string;
  company_name_cn: string;
  company_name_en: string;
  website: string | null;
  domain: string | null;
  industry_primary: string;
  industry_secondary: string | null;
  company_type: string;
  china_linked: boolean;
  china_link_strength: number;
  hq_country: string;
  hq_city: string | null;
  operating_regions: string[];
  english_site: boolean;
  status: string;
  description: string;
  source_count: number;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface CompanySignal {
  signal_id: string;
  company_id: string;
  signal_type: string;
  signal_subtype: string;
  title: string;
  evidence_text: string;
  source_url: string;
  source_date: string;
  confidence: number;
  raw_metadata: Record<string, unknown>;
  mapped_fields: string[];
  created_at: string;
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
}

export interface FundingEvent {
  funding_id: string;
  company_id: string;
  round_name: string;
  announce_date: string;
  amount_text: string;
  currency_hint: string | null;
  investors: string[];
  international_investor_flag: boolean;
  offshore_entity_hint: boolean;
  source_url: string | null;
  confidence: number;
}

export interface AgentScore {
  score_id: string;
  company_id: string;
  agent_type: AgentType;
  fit_score: number;
  confidence_score: number;
  priority_tier: PriorityTier;
  reasons: string[];
  recommended_roles: string[];
  opening_angle: string;
  next_action: string;
  likely_needs: string[];
  hybrid_tag: string | null;
  updated_at: string;
}

export interface LeadCard {
  company: CompanySummary;
  primary_score: AgentScore;
  secondary_score: AgentScore | null;
  latest_signal: CompanySignal | null;
  evidence_count: number;
  why_matched: string[];
  likely_needs: string[];
  recommended_roles: string[];
  opening_angle_summary: string;
}

export interface LeadDetailResponse {
  company: CompanySummary;
  primary_score: AgentScore;
  secondary_score: AgentScore | null;
  funding_events: FundingEvent[];
  signals: CompanySignal[];
  timeline: CompanySignal[];
  evidence_count: number;
  company_summary: string;
  why_matched: string[];
  likely_needs: string[];
  recommended_roles: string[];
  opening_angle: string;
  risk_note: string;
  watchlist_entry: WatchlistEntry | null;
}

export interface SearchFilters {
  agent_type?: AgentType | "";
  industry?: string;
  geography?: string;
  recent_activity_window_days?: number | null;
  funding_stage?: string;
  english_website?: boolean | null;
  offshore_structure_hint?: boolean | null;
  multi_country_operations?: boolean | null;
  overseas_factory?: boolean | null;
  minimum_score?: number;
  page?: number;
  page_size?: number;
  sort_by?: "fit_score" | "confidence_score" | "last_seen_at";
  sort_order?: "asc" | "desc";
}

export interface SearchRecord {
  search_id: string;
  user_query_name: string;
  filters_json: Record<string, unknown>;
  result_count: number;
  created_at: string;
}

export interface PaginatedLeadsResponse {
  items: LeadCard[];
  total: number;
  page: number;
  page_size: number;
  sort_by: string;
  sort_order: string;
}

export interface SearchRequest {
  user_query_name: string;
  filters: SearchFilters;
}

export interface WatchlistEntry {
  watchlist_id: string;
  company_id: string;
  notes: string;
  tags: string[];
  created_at: string;
}

export interface WatchlistRequest {
  company_id: string;
  notes?: string;
  tags?: string[];
}

export interface ExportRequest {
  format: "csv" | "xlsx" | "json";
  company_ids?: string[];
  watchlist_only?: boolean;
}

export interface ExportResponse {
  format: "csv" | "xlsx" | "json";
  filename: string;
  content_type: string;
  payload: string;
  exported_count: number;
}

export interface SignalReviewRequest {
  review_status: Exclude<ReviewStatus, null>;
  note?: string;
}

export interface SignalReviewResponse {
  signal_id: string;
  review_status: Exclude<ReviewStatus, null>;
  note: string | null;
  reviewed_at: string;
}

export interface LlmLeadSummary {
  company_summary: string;
  primary_agent_type: AgentType;
  secondary_agent_type?: AgentType | null;
  fit_score: number;
  priority_tier: PriorityTier;
  why_matched: string[];
  likely_needs: string[];
  recommended_roles: string[];
  opening_angle: string;
  risk_note: string;
}
