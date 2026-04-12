import { Globe2, Landmark, Users } from 'lucide-react';
import { useStore } from '../../store';

export function LeadDetailView() {
  const leads = useStore((state) => state.leads);
  const selectedLeadId = useStore((state) => state.selectedLeadId);
  const generateExport = useStore((state) => state.generateExport);
  const toggleLeadSelection = useStore((state) => state.toggleLeadSelection);
  const selectedLeadIds = useStore((state) => state.selectedLeadIds);

  const lead = leads.find((item) => item.id === selectedLeadId) ?? leads[0];

  if (!lead) {
    return <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">No lead selected.</div>;
  }

  const selected = selectedLeadIds.includes(lead.id);

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(249,115,22,0.08),rgba(255,255,255,0.04))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Lead Card</div>
            <h3 className="mt-3 text-3xl font-semibold text-white">{lead.name}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{lead.company_profile}</p>
          </div>
          <div className="rounded-[28px] border border-orange-300/20 bg-slate-950/40 px-5 py-4 text-center">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Final lead score</div>
            <div className="mt-2 text-5xl font-semibold text-white">{lead.lead_score.final_lead_score}</div>
            <div className="mt-2 text-sm text-orange-100">{lead.stage}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => toggleLeadSelection(lead.id)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100"
          >
            {selected ? 'Remove from export' : 'Mark for export'}
          </button>
          <button
            onClick={() => void generateExport('json')}
            className="rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm font-medium text-slate-950"
          >
            Preview JSON export
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SignalCard title="Funding signal summary" icon={<Landmark size={18} />} body={lead.funding_signal_summary} />
        <SignalCard title="Globalization signal summary" icon={<Globe2 size={18} />} body={lead.globalization_signal_summary} />
        <SignalCard title="Infra-demand likelihood" icon={<Users size={18} />} body={lead.infra_demand_likelihood} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Target contact roles</div>
          <div className="mt-4 flex flex-wrap gap-3">
            {lead.target_contact_roles.map((role) => (
              <span key={role} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                {role}
              </span>
            ))}
          </div>

          <div className="mt-6 text-xs uppercase tracking-[0.18em] text-slate-400">Recommended opening angle</div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{lead.recommended_opening_angle}</p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Metric title="Funding score" value={lead.lead_score.funding_score} />
            <Metric title="Globalization score" value={lead.lead_score.globalization_score} />
            <Metric title="Infra fit score" value={lead.lead_score.infra_fit_score} />
            <Metric title="Qualification confidence" value={lead.lead_score.qualification_confidence} />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Latest funding event</div>
          <div className="mt-4 text-2xl font-semibold text-white">{lead.latest_funding_event.round_name}</div>
          <div className="mt-1 text-sm text-slate-300">
            {lead.latest_funding_event.announced_at} · ${lead.latest_funding_event.amount_usd_m}M
          </div>
          <div className="mt-4 text-sm leading-6 text-slate-300">{lead.latest_funding_event.funding_signal_summary}</div>

          <div className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-400">Investors</div>
          <div className="mt-3 space-y-2">
            {lead.latest_funding_event.investors.map((investor) => (
              <div key={investor} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                {investor}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SignalCard({ title, icon, body }: { title: string; icon: React.ReactNode; body: string }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
        <span className="text-orange-100">{icon}</span>
        {title}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{body}</p>
    </article>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
