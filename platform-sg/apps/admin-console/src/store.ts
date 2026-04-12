import { create } from 'zustand';
import { discoverCandidates, fetchExportBundle, fetchLeads } from './api/leadIntel';
import { DEFAULT_DISCOVERY_RESULT, DEFAULT_FILTERS, SEED_LEADS } from './mockData';
import type { ActiveView, DiscoveryResult, ExportBundle, LeadCard, SearchFilters } from './types';

interface AppState {
  activeView: ActiveView;
  filters: SearchFilters;
  leads: LeadCard[];
  selectedLeadId: string | null;
  selectedLeadIds: string[];
  discoveryResult: DiscoveryResult;
  exportBundle: ExportBundle | null;
  loadingLeads: boolean;
  loadingExport: boolean;
  lastUpdatedAt: string;
  setActiveView: (view: ActiveView) => void;
  setFilters: (patch: Partial<SearchFilters>) => void;
  loadLeads: () => Promise<void>;
  runDiscovery: () => Promise<void>;
  selectLead: (id: string) => void;
  toggleLeadSelection: (id: string) => void;
  selectAllVisibleLeads: () => void;
  clearLeadSelection: () => void;
  generateExport: (format: 'json' | 'csv') => Promise<void>;
}

export const useStore = create<AppState>()((set, get) => ({
  activeView: 'search',
  filters: DEFAULT_FILTERS,
  leads: SEED_LEADS.filter((lead) => lead.lead_score.final_lead_score >= DEFAULT_FILTERS.minScore && lead.is_usd_backed),
  selectedLeadId: SEED_LEADS[0]?.id ?? null,
  selectedLeadIds: SEED_LEADS.slice(0, 2).map((lead) => lead.id),
  discoveryResult: DEFAULT_DISCOVERY_RESULT,
  exportBundle: null,
  loadingLeads: false,
  loadingExport: false,
  lastUpdatedAt: new Date().toISOString(),
  setActiveView: (view) => set({ activeView: view }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  loadLeads: async () => {
    set({ loadingLeads: true });
    const filters = get().filters;
    const leads = await fetchLeads(filters);
    set((state) => ({
      leads,
      selectedLeadId: leads.find((lead) => lead.id === state.selectedLeadId)?.id ?? leads[0]?.id ?? null,
      selectedLeadIds: state.selectedLeadIds.filter((id) => leads.some((lead) => lead.id === id)),
      loadingLeads: false,
      lastUpdatedAt: new Date().toISOString(),
    }));
  },
  runDiscovery: async () => {
    const filters = get().filters;
    const discoveryResult = await discoverCandidates(filters);
    set({
      discoveryResult,
      activeView: 'search',
      lastUpdatedAt: new Date().toISOString(),
    });
  },
  selectLead: (id) => set({ selectedLeadId: id, activeView: 'detail' }),
  toggleLeadSelection: (id) =>
    set((state) => ({
      selectedLeadIds: state.selectedLeadIds.includes(id)
        ? state.selectedLeadIds.filter((item) => item !== id)
        : [...state.selectedLeadIds, id],
    })),
  selectAllVisibleLeads: () => set((state) => ({ selectedLeadIds: state.leads.map((lead) => lead.id) })),
  clearLeadSelection: () => set({ selectedLeadIds: [] }),
  generateExport: async (format) => {
    set({ loadingExport: true });
    const ids = get().selectedLeadIds;
    const exportBundle = await fetchExportBundle(ids, format);
    set({
      exportBundle,
      loadingExport: false,
      activeView: 'export',
      lastUpdatedAt: new Date().toISOString(),
    });
  },
}));
