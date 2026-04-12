import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '../store';

const VIEW_LABELS = {
  search: 'Candidate discovery and qualification',
  leads: 'Ranked lead intelligence list',
  detail: 'CRM-ready lead card detail',
  export: 'Export and handoff workspace',
} as const;

export function TopBar() {
  const activeView = useStore((state) => state.activeView);
  const lastUpdatedAt = useStore((state) => state.lastUpdatedAt);
  const loadingLeads = useStore((state) => state.loadingLeads);
  const runDiscovery = useStore((state) => state.runDiscovery);
  const loadLeads = useStore((state) => state.loadLeads);
  const generateExport = useStore((state) => state.generateExport);

  return (
    <header className="border-b border-white/10 bg-[#111827]/70 px-8 py-5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-orange-100">
            <Sparkles size={12} />
            Lead Discovery Agent Platform
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{VIEW_LABELS[activeView]}</h2>
          <p className="mt-2 text-sm text-slate-300">
            Focused on accurate qualification, demand inference, and exportable intelligence for DCDeepTech sellers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void runDiscovery()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCw size={15} />
            Refresh discovery
          </button>
          <button
            onClick={() => void loadLeads()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/15"
          >
            {loadingLeads ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Re-score list
          </button>
          <button
            onClick={() => void generateExport('csv')}
            className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-95"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-400">Last intelligence refresh: {new Date(lastUpdatedAt).toLocaleString()}</div>
    </header>
  );
}
