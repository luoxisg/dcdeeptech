import { ArrowUpRight, CheckSquare2, Square } from 'lucide-react';
import { useStore } from '../../store';

export function LeadsView() {
  const leads = useStore((state) => state.leads);
  const selectedLeadIds = useStore((state) => state.selectedLeadIds);
  const toggleLeadSelection = useStore((state) => state.toggleLeadSelection);
  const selectLead = useStore((state) => state.selectLead);
  const selectAllVisibleLeads = useStore((state) => state.selectAllVisibleLeads);
  const clearLeadSelection = useStore((state) => state.clearLeadSelection);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">Qualified lead list</h3>
          <p className="mt-1 text-sm text-slate-300">Ranked for export readiness, funding quality, and likely infrastructure demand.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={selectAllVisibleLeads} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            Select all visible
          </button>
          <button onClick={clearLeadSelection} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            Clear selection
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
        <table className="w-full border-collapse">
          <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Pick</th>
              <th className="px-5 py-4">Company</th>
              <th className="px-5 py-4">Funding</th>
              <th className="px-5 py-4">Globalization</th>
              <th className="px-5 py-4">Infra demand</th>
              <th className="px-5 py-4">Score</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const selected = selectedLeadIds.includes(lead.id);
              return (
                <tr key={lead.id} className="border-t border-white/6 text-sm text-slate-200">
                  <td className="px-5 py-4">
                    <button onClick={() => toggleLeadSelection(lead.id)} className="text-orange-100">
                      {selected ? <CheckSquare2 size={18} /> : <Square size={18} />}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{lead.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {lead.hq_country} · {lead.stage} · {lead.china_link_type}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{lead.latest_funding_event.round_name}</div>
                    <div className="mt-1 text-slate-400">${lead.latest_funding_event.amount_usd_m}M</div>
                  </td>
                  <td className="px-5 py-4">
                    <div>{lead.global_regions.join(', ')}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="max-w-sm text-slate-300">{lead.infra_demand_likelihood}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="inline-flex rounded-full bg-emerald-400/12 px-3 py-1 font-medium text-emerald-100">
                      {lead.lead_score.final_lead_score}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => selectLead(lead.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                    >
                      Open
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
