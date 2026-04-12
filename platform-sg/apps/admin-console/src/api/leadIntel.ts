import { DEFAULT_DISCOVERY_RESULT, DEFAULT_EXPORT_BUNDLE, SEED_LEADS } from '../mockData';
import type { DiscoveryResult, ExportBundle, LeadCard, SearchFilters } from '../types';

const BASE_URL = import.meta.env.VITE_LEAD_INTEL_API_URL ?? 'http://localhost:8082';

function applyFilters(leads: LeadCard[], filters: SearchFilters) {
  return leads.filter((lead) => {
    const matchesSearch =
      !filters.search ||
      `${lead.name} ${lead.summary} ${lead.company_profile}`.toLowerCase().includes(filters.search.toLowerCase());
    const matchesRegion =
      !filters.region ||
      lead.global_regions.some((region) => region.toLowerCase().includes(filters.region.toLowerCase()));
    const matchesStage = !filters.stage || lead.stage === filters.stage;
    const matchesScore = lead.lead_score.final_lead_score >= filters.minScore;
    const matchesUsd = !filters.usdBackedOnly || lead.is_usd_backed;
    const matchesIntl = !filters.internationalBackingOnly || lead.international_backing;
    return matchesSearch && matchesRegion && matchesStage && matchesScore && matchesUsd && matchesIntl;
  });
}

export async function fetchLeads(filters: SearchFilters): Promise<LeadCard[]> {
  const params = new URLSearchParams({
    search: filters.search,
    region: filters.region,
    min_score: String(filters.minScore),
  });
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.usdBackedOnly) params.set('usd_backed_only', 'true');
  if (filters.internationalBackingOnly) params.set('international_backing_only', 'true');

  try {
    const response = await fetch(`${BASE_URL}/lead-intel/companies?${params.toString()}`);
    if (!response.ok) throw new Error('Lead API unavailable');
    const data = await response.json();
    return data.items as LeadCard[];
  } catch {
    return applyFilters(SEED_LEADS, filters);
  }
}

export async function discoverCandidates(filters: SearchFilters): Promise<DiscoveryResult> {
  try {
    const response = await fetch(`${BASE_URL}/lead-intel/discovery/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: filters.search || 'China-linked AI infrastructure buyers',
        region_focus: filters.region || undefined,
        min_score: filters.minScore,
      }),
    });
    if (!response.ok) throw new Error('Discovery API unavailable');
    return (await response.json()) as DiscoveryResult;
  } catch {
    return {
      ...DEFAULT_DISCOVERY_RESULT,
      query: filters.search || DEFAULT_DISCOVERY_RESULT.query,
      shortlisted: applyFilters(SEED_LEADS, filters).slice(0, 3),
      candidates_found: applyFilters(SEED_LEADS, filters).length,
    };
  }
}

export async function fetchExportBundle(ids: string[], format: 'json' | 'csv'): Promise<ExportBundle> {
  const params = new URLSearchParams({ format, ids: ids.join(',') });
  try {
    const response = await fetch(`${BASE_URL}/lead-intel/export?${params.toString()}`);
    if (!response.ok) throw new Error('Export API unavailable');
    return (await response.json()) as ExportBundle;
  } catch {
    const rows = SEED_LEADS.filter((lead) => ids.length === 0 || ids.includes(lead.id)).map((lead) => ({
      company: lead.name,
      hq_country: lead.hq_country,
      website: lead.website,
      stage: lead.stage,
      final_lead_score: lead.lead_score.final_lead_score,
      funding_signal_summary: lead.funding_signal_summary,
      globalization_signal_summary: lead.globalization_signal_summary,
      infra_demand_likelihood: lead.infra_demand_likelihood,
      target_contact_roles: lead.target_contact_roles.join(', '),
      recommended_opening_angle: lead.recommended_opening_angle,
    }));
    const columns = rows[0] ? Object.keys(rows[0]) : DEFAULT_EXPORT_BUNDLE.columns;
    const payload =
      format === 'json'
        ? JSON.stringify(rows, null, 2)
        : [columns.join(','), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column as keyof typeof row])).join(','))].join('\n');

    return {
      format,
      generated_at: new Date().toISOString(),
      record_count: rows.length,
      columns,
      payload,
    };
  }
}
