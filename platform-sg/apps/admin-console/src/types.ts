export type ActiveView = 'search' | 'leads' | 'detail' | 'export';

export interface FundingEvent {
  id: string;
  company_id: string;
  announced_at: string;
  round_name: string;
  amount_usd_m: number;
  investors: string[];
  funding_signal_summary: string;
}

export interface LeadScore {
  company_id: string;
  funding_score: number;
  globalization_score: number;
  infra_fit_score: number;
  qualification_confidence: number;
  final_lead_score: number;
  score_rationale: string;
  last_qualified_at: string;
  target_roles: string[];
  opening_angle: string;
}

export interface LeadCard {
  id: string;
  name: string;
  normalized_name: string;
  website: string;
  hq_country: string;
  china_link_type: string;
  global_regions: string[];
  summary: string;
  company_profile: string;
  funding_signal_summary: string;
  globalization_signal_summary: string;
  infra_demand_likelihood: string;
  target_contact_roles: string[];
  recommended_opening_angle: string;
  employee_band: string;
  stage: string;
  is_usd_backed: boolean;
  international_backing: boolean;
  latest_funding_event: FundingEvent;
  lead_score: LeadScore;
}

export interface SearchFilters {
  search: string;
  region: string;
  minScore: number;
  stage: string;
  usdBackedOnly: boolean;
  internationalBackingOnly: boolean;
}

export interface DiscoveryResult {
  query: string;
  candidates_found: number;
  shortlisted: LeadCard[];
  connector_notes: string[];
}

export interface ExportBundle {
  format: 'json' | 'csv';
  generated_at: string;
  record_count: number;
  columns: string[];
  payload: string;
}
