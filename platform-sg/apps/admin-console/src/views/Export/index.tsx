import { Copy, FileJson2, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../../store';

export function ExportView() {
  const exportBundle = useStore((state) => state.exportBundle);
  const selectedLeadIds = useStore((state) => state.selectedLeadIds);
  const generateExport = useStore((state) => state.generateExport);
  const loadingExport = useStore((state) => state.loadingExport);

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">CRM-ready lead intelligence</div>
            <h3 className="mt-3 text-2xl font-semibold text-white">Export package</h3>
            <p className="mt-2 text-sm text-slate-300">
              Export selected lead cards with qualification summaries, contact roles, opening angles, and final score. No auto-email sending is included in v1.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => void generateExport('csv')}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100"
            >
              <FileSpreadsheet size={15} />
              {loadingExport ? 'Generating...' : 'Generate CSV'}
            </button>
            <button
              onClick={() => void generateExport('json')}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm font-medium text-slate-950"
            >
              <FileJson2 size={15} />
              Generate JSON
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Selected leads" value={selectedLeadIds.length} />
        <StatCard title="Export format" value={exportBundle?.format.toUpperCase() ?? 'CSV'} />
        <StatCard title="Columns" value={exportBundle?.columns.length ?? 10} />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Payload preview</div>
            <div className="mt-2 text-sm text-slate-300">
              {exportBundle ? `${exportBundle.record_count} records generated at ${new Date(exportBundle.generated_at).toLocaleString()}` : 'Generate an export to preview the payload.'}
            </div>
          </div>
          {exportBundle && (
            <button
              onClick={() => void navigator.clipboard.writeText(exportBundle.payload)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100"
            >
              <Copy size={15} />
              Copy payload
            </button>
          )}
        </div>
        <pre className="mt-5 max-h-[520px] overflow-auto rounded-[24px] border border-white/8 bg-[#091018] p-5 text-xs leading-6 text-emerald-100">
          {exportBundle?.payload || 'No export generated yet.'}
        </pre>
      </section>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}
