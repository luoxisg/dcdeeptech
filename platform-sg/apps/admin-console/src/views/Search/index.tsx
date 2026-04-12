import { Search, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useEffect } from 'react';
import { useStore } from '../../store';

const STAGES = ['', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];

export function SearchView() {
  const filters = useStore((state) => state.filters);
  const setFilters = useStore((state) => state.setFilters);
  const loadLeads = useStore((state) => state.loadLeads);
  const runDiscovery = useStore((state) => state.runDiscovery);
  const discoveryResult = useStore((state) => state.discoveryResult);

  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    void loadLeads();
  }, [filters.region, filters.minScore, filters.stage, filters.usdBackedOnly, filters.internationalBackingOnly, deferredSearch, loadLeads]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-orange-100/80">
            <Search size={14} />
            Candidate Discovery
          </div>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">Find China-linked companies with real overseas infrastructure intent.</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Search for companies with USD or international backing, cross-border operating signals, and a likely need for AI gateway, inference, compliance, or OCP-oriented infrastructure.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Search focus</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters({ search: event.target.value })}
                placeholder="robotics, APAC expansion, AI chips..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-300/40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Region signal</span>
              <input
                value={filters.region}
                onChange={(event) => setFilters({ region: event.target.value })}
                placeholder="Singapore, Dubai, Munich..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-300/40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Stage</span>
              <select
                value={filters.stage}
                onChange={(event) => setFilters({ stage: event.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-300/40"
              >
                {STAGES.map((stage) => (
                  <option key={stage || 'all'} value={stage}>
                    {stage || 'All stages'}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Minimum score</span>
              <input
                type="range"
                min={50}
                max={95}
                step={1}
                value={filters.minScore}
                onChange={(event) => setFilters({ minScore: Number(event.target.value) })}
                className="mt-4 w-full accent-orange-400"
              />
              <div className="text-sm text-white">{filters.minScore}+</div>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
            <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <input
                type="checkbox"
                checked={filters.usdBackedOnly}
                onChange={(event) => setFilters({ usdBackedOnly: event.target.checked })}
              />
              USD-backed only
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <input
                type="checkbox"
                checked={filters.internationalBackingOnly}
                onChange={(event) => setFilters({ internationalBackingOnly: event.target.checked })}
              />
              Internationally backed only
            </label>
            <button
              onClick={() => void runDiscovery()}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 font-medium text-slate-950"
            >
              <SlidersHorizontal size={15} />
              Run qualification sweep
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Connector Notes</div>
          <div className="mt-4 text-4xl font-semibold text-white">{discoveryResult.candidates_found}</div>
          <div className="text-sm text-slate-300">candidates found for “{discoveryResult.query}”</div>

          <div className="mt-5 space-y-3">
            {discoveryResult.connector_notes.map((note) => (
              <div key={note} className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
                {note}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {discoveryResult.shortlisted.map((lead) => (
          <article key={lead.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{lead.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {lead.hq_country} · {lead.stage}
                </div>
              </div>
              <div className="rounded-full bg-orange-400/15 px-3 py-1 text-sm font-medium text-orange-100">
                {lead.lead_score.final_lead_score}
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{lead.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {lead.global_regions.map((region) => (
                <span key={region} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {region}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
