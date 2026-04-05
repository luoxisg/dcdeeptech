import { useState } from 'react';
import { Plus, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useStore } from '../../store';
import type { BreachIncident, BreachSeverity, BreachStatus, CreateBreachRequest } from '../../types';

const SEVERITY_LABELS: Record<BreachSeverity, string> = {
  low: '低',  medium: '中',  high: '高',  critical: '严重',
};
const SEVERITY_COLOR: Record<BreachSeverity, string> = {
  low: 'bg-blue-500/20 text-blue-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  high: 'bg-orange-500/20 text-orange-300',
  critical: 'bg-red-500/20 text-red-300',
};

// PDPA breach notification workflow — order matters
const BREACH_STEPS: { status: BreachStatus; label: string; sub: string }[] = [
  { status: 'detected',          label: '检测到事件',   sub: '记录发现时间' },
  { status: 'assessing',         label: '评估影响',     sub: '确认受影响人数' },
  { status: 'notified_internal', label: '内部通知',     sub: 'DPO / 管理层' },
  { status: 'notified_pdpc',     label: '通知 PDPC',    sub: '3天法定期限' },
  { status: 'notified_affected', label: '通知受影响人', sub: '适时通知' },
  { status: 'closed',            label: '关闭事件',     sub: '补救措施完成' },
];

function HoursLeft({ deadline }: { deadline: string }) {
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 3600000);
  if (diff < 0) return <span className="text-xs text-red-400 font-bold animate-pulse">已超期 {Math.abs(diff)}h</span>;
  if (diff <= 12) return <span className="text-xs text-red-400 font-semibold">{diff}h 剩余</span>;
  if (diff <= 48) return <span className="text-xs text-yellow-400">{diff}h 剩余</span>;
  return <span className="text-xs text-gray-500">{diff}h 剩余</span>;
}

function BreachPipeline({ incident }: { incident: BreachIncident }) {
  const curIdx = BREACH_STEPS.findIndex((s) => s.status === incident.status);
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-1">
      {BREACH_STEPS.map((step, i) => {
        const done = i < curIdx;
        const active = i === curIdx;
        const pdpcStep = step.status === 'notified_pdpc';
        return (
          <div key={step.status} className="flex items-start gap-1 shrink-0">
            <div className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-center min-w-[72px] border ${
              active ? 'border-blue-500/60 bg-blue-500/10' :
              done  ? 'border-emerald-500/40 bg-emerald-500/5' :
              'border-gray-700 bg-transparent'
            }`}>
              <div className={`w-3 h-3 rounded-full border-2 ${
                active ? 'bg-blue-400 border-blue-400 animate-pulse' :
                done   ? 'bg-emerald-500 border-emerald-500' :
                'bg-gray-700 border-gray-600'
              }`} />
              <span className={`text-[10px] font-medium leading-tight ${
                active ? 'text-blue-300' : done ? 'text-emerald-300' : 'text-gray-600'
              }`}>{step.label}</span>
              <span className={`text-[9px] leading-tight ${
                pdpcStep && active ? 'text-red-400 font-semibold' : 'text-gray-600'
              }`}>{step.sub}</span>
            </div>
            {i < BREACH_STEPS.length - 1 && (
              <div className={`w-4 h-0.5 mt-3 shrink-0 ${done ? 'bg-emerald-500' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BreachPanel() {
  const breachIncidents = useStore((s) => s.breachIncidents);
  const addBreach = useStore((s) => s.addBreach);
  const updateBreachStatus = useStore((s) => s.updateBreachStatus);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateBreachRequest>({
    title: '', severity: 'medium', description: '', affected_count: 0,
  });

  const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

  async function submit() {
    if (!form.title) return;
    const now = new Date();
    // PDPA: 3 working days to notify PDPC for significant breaches
    const pdpcDeadline = new Date(now.getTime() + 3 * 86400000);
    const inc: BreachIncident = {
      id: `breach_${Math.random().toString(36).slice(2, 10)}`,
      ...form,
      status: 'detected',
      detected_at: now.toISOString(),
      pdpc_deadline: pdpcDeadline.toISOString(),
      notified_pdpc_at: null,
      notified_affected_at: null,
      closed_at: null,
    };
    if (GATEWAY_URL) {
      try {
        await fetch(`${GATEWAY_URL}/compliance/breach`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
      } catch { /* demo fallback */ }
    }
    addBreach(inc);
    setShowForm(false);
    setForm({ title: '', severity: 'medium', description: '', affected_count: 0 });
  }

  function advance(inc: BreachIncident) {
    const curIdx = BREACH_STEPS.findIndex((s) => s.status === inc.status);
    if (curIdx < BREACH_STEPS.length - 1) {
      const next = BREACH_STEPS[curIdx + 1].status;
      const patch: Partial<BreachIncident> = {};
      if (next === 'notified_pdpc') patch.notified_pdpc_at = new Date().toISOString();
      if (next === 'notified_affected') patch.notified_affected_at = new Date().toISOString();
      if (next === 'closed') patch.closed_at = new Date().toISOString();
      updateBreachStatus(inc.id, next, patch);
    }
  }

  const open = breachIncidents.filter((b) => b.status !== 'closed').length;

  return (
    <div className="space-y-4">
      {/* PDPA breach workflow info */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">违规通知义务（PDPA §26D）</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 font-semibold mb-1">3天法定期限</p>
            <p className="text-gray-400">重大违规须在 3 个工作日内通知 PDPC（个人数据保护委员会）</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-400 font-semibold mb-1">通知 PDPC 内容</p>
            <p className="text-gray-400">事件描述、受影响人数、类型、已采取措施</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-400 font-semibold mb-1">通知受影响个人</p>
            <p className="text-gray-400">若造成重大损害风险，须"适时"通知当事人</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">
          {open > 0
            ? <span className="text-red-400 font-semibold">{open} 起未关闭事件</span>
            : <span className="text-emerald-400">无未关闭事件</span>
          }
          <span className="text-gray-500 ml-2">共 {breachIncidents.length} 起</span>
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> 登记违规事件
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-800/60 border border-red-500/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertTriangle size={14} /> 登记数据违规事件
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">事件标题</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="用户数据库未授权访问" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">严重程度</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as BreachSeverity })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200">
                {(Object.entries(SEVERITY_LABELS) as [BreachSeverity, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">受影响人数</label>
              <input type="number" value={form.affected_count}
                onChange={(e) => setForm({ ...form, affected_count: parseInt(e.target.value) || 0 })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">事件描述</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded-lg transition-colors">登记</button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200 text-xs px-4 py-2">取消</button>
          </div>
        </div>
      )}

      {/* Incidents list */}
      {breachIncidents.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">无违规事件记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {breachIncidents.map((inc) => (
            <div key={inc.id} className={`bg-gray-800/60 rounded-xl border p-4 space-y-3 ${
              inc.status !== 'closed' ? 'border-red-500/20' : 'border-gray-700'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-200">{inc.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLOR[inc.severity]}`}>
                      {SEVERITY_LABELS[inc.severity]}
                    </span>
                    {inc.status === 'closed'
                      ? <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">已关闭</span>
                      : <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full animate-pulse">进行中</span>
                    }
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {inc.id} · 受影响 {inc.affected_count.toLocaleString()} 人 · 发现于 {new Date(inc.detected_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                {inc.status !== 'closed' && <HoursLeft deadline={inc.pdpc_deadline} />}
              </div>

              {/* Workflow pipeline */}
              <BreachPipeline incident={inc} />

              {inc.description && (
                <p className="text-xs text-gray-400 bg-gray-700/40 rounded-lg px-3 py-2">{inc.description}</p>
              )}

              {/* PDPC deadline warning */}
              {inc.status !== 'closed' && inc.status !== 'notified_pdpc' && inc.status !== 'notified_affected' && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  <Clock size={12} />
                  PDPC 通知截止：{new Date(inc.pdpc_deadline).toLocaleString('zh-CN')}
                  <HoursLeft deadline={inc.pdpc_deadline} />
                </div>
              )}

              {/* Action */}
              {inc.status !== 'closed' && (
                <button
                  onClick={() => advance(inc)}
                  className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  推进至：{BREACH_STEPS[BREACH_STEPS.findIndex((s) => s.status === inc.status) + 1]?.label ?? '关闭'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
