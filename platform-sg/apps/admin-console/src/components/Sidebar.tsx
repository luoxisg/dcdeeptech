import { Download, FileSearch, LayoutList, Radar, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import type { ActiveView } from '../types';

const NAV_ITEMS: { id: ActiveView; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'search', label: 'Discovery', hint: 'Search + qualify', icon: <Radar size={18} /> },
  { id: 'leads', label: 'Lead List', hint: 'Ranked prospects', icon: <LayoutList size={18} /> },
  { id: 'detail', label: 'Lead Detail', hint: 'Card + rationale', icon: <FileSearch size={18} /> },
  { id: 'export', label: 'Export', hint: 'CRM-ready output', icon: <Download size={18} /> },
];

export function Sidebar() {
  const activeView = useStore((state) => state.activeView);
  const setActiveView = useStore((state) => state.setActiveView);
  const leads = useStore((state) => state.leads);
  const selectedLeadIds = useStore((state) => state.selectedLeadIds);
  const avgScore =
    leads.length === 0 ? 0 : Math.round(leads.reduce((sum, lead) => sum + lead.lead_score.final_lead_score, 0) / leads.length);

  return (
    <aside className="w-full max-w-[290px] shrink-0 border-r border-white/10 bg-[#0f1720]/90 backdrop-blur">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#22c55e] shadow-[0_12px_30px_rgba(249,115,22,0.28)]">
          <Sparkles size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white">DCDeepTech Leads</h1>
        <p className="mt-2 text-sm text-slate-300">
          China-linked B2B lead discovery for cross-border AI infrastructure, gateway, inference, and compliance demand.
        </p>
      </div>

      <nav className="space-y-2 px-4 py-5">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeView;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-orange-300/40 bg-orange-400/12 text-white shadow-[0_12px_30px_rgba(249,115,22,0.12)]'
                  : 'border-white/5 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={active ? 'text-orange-200' : 'text-slate-400'}>{item.icon}</span>
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.hint}</div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-6">
        <div className="rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Pipeline Snapshot</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xl font-semibold text-white">{leads.length}</div>
              <div className="text-xs text-slate-400">Qualified leads</div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xl font-semibold text-white">{avgScore}</div>
              <div className="text-xs text-slate-400">Avg score</div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xl font-semibold text-white">{selectedLeadIds.length}</div>
              <div className="text-xs text-slate-400">Marked for export</div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xl font-semibold text-white">v1</div>
              <div className="text-xs text-slate-400">No auto-email</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
