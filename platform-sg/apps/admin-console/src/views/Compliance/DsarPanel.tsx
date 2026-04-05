import { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import type { DsarRequest, DsarStatus, DsarType, CreateDsarRequest } from '../../types';

const STATUS_STEPS: DsarStatus[] = ['pending', 'verifying', 'processing', 'completed'];

const STATUS_LABELS: Record<DsarStatus, string> = {
  pending: '待审核',
  verifying: '身份核验',
  processing: '处理中',
  completed: '已完成',
  rejected: '已拒绝',
};

const TYPE_LABELS: Record<DsarType, string> = {
  access: '数据访问',
  correction: '数据更正',
  deletion: '数据删除',
  withdrawal: '撤回同意',
};

const STATUS_COLOR: Record<DsarStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  verifying: 'bg-blue-500/20 text-blue-300',
  processing: 'bg-purple-500/20 text-purple-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
};

function StatusPipeline({ status }: { status: DsarStatus }) {
  const isRejected = status === 'rejected';
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const stepIdx = STATUS_STEPS.indexOf(step);
        const curIdx = STATUS_STEPS.indexOf(status as DsarStatus);
        const active = !isRejected && stepIdx <= curIdx;
        const current = !isRejected && step === status;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={`flex flex-col items-center gap-0.5`}>
              <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                current ? 'bg-blue-400 border-blue-400 scale-125' :
                active ? 'bg-emerald-500 border-emerald-500' :
                'bg-gray-700 border-gray-600'
              }`} />
              <span className={`text-[9px] whitespace-nowrap ${active ? 'text-gray-300' : 'text-gray-600'}`}>
                {STATUS_LABELS[step]}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`w-6 h-0.5 mb-3 ${active && STATUS_STEPS.indexOf(STATUS_STEPS[i+1]) <= curIdx ? 'bg-emerald-500' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
      {isRejected && (
        <span className="text-xs text-red-400 ml-2">已拒绝</span>
      )}
    </div>
  );
}

function DaysLeft({ due_at }: { due_at: string }) {
  const diff = Math.ceil((new Date(due_at).getTime() - Date.now()) / 86400000);
  if (diff < 0) return <span className="text-xs text-red-400 font-bold">已超期 {Math.abs(diff)} 天</span>;
  if (diff <= 5) return <span className="text-xs text-yellow-400">剩余 {diff} 天</span>;
  return <span className="text-xs text-gray-500">剩余 {diff} 天</span>;
}

export function DsarPanel() {
  const dsarRequests = useStore((s) => s.dsarRequests);
  const addDsar = useStore((s) => s.addDsar);
  const updateDsarStatus = useStore((s) => s.updateDsarStatus);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateDsarRequest>({
    type: 'access', subject_name: '', subject_email: '', tenant_id: '', description: '',
  });

  const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

  async function submit() {
    if (!form.subject_name || !form.subject_email) return;
    const now = new Date();
    const due = new Date(now.getTime() + 30 * 86400000);
    const req: DsarRequest = {
      id: `dsar_${Math.random().toString(36).slice(2, 10)}`,
      ...form,
      status: 'pending',
      submitted_at: now.toISOString(),
      due_at: due.toISOString(),
      resolved_at: null,
      notes: '',
    };
    if (GATEWAY_URL) {
      try {
        await fetch(`${GATEWAY_URL}/compliance/dsar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
      } catch { /* demo fallback */ }
    }
    addDsar(req);
    setShowForm(false);
    setForm({ type: 'access', subject_name: '', subject_email: '', tenant_id: '', description: '' });
  }

  function advance(id: string, cur: DsarStatus) {
    const idx = STATUS_STEPS.indexOf(cur);
    if (idx < STATUS_STEPS.length - 1) updateDsarStatus(id, STATUS_STEPS[idx + 1]);
  }

  return (
    <div className="space-y-4">
      {/* DSAR process explanation */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">数据主体权利请求流程（PDPA §21–22）</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {['① 主体提交请求', '② 身份核验 (3天)', '③ 系统处理数据', '④ 30天内书面答复'].map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-700/50 px-3 py-2 rounded-lg">
              <span className="text-blue-400 font-bold">{s.slice(0, 1)}</span>
              <span className="text-gray-300">{s.slice(1)}</span>
              {i < 3 && <ChevronRight size={12} className="text-gray-500" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{dsarRequests.length} 条请求</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> 新建 DSAR 请求
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-800/60 border border-blue-500/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-300">新建数据主体权利请求</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">请求类型</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DsarType })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                {(Object.entries(TYPE_LABELS) as [DsarType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">租户 ID</label>
              <input
                value={form.tenant_id}
                onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                placeholder="tenant-acme"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">数据主体姓名</label>
              <input
                value={form.subject_name}
                onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                placeholder="张三"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">联系邮箱</label>
              <input
                value={form.subject_email}
                onChange={(e) => setForm({ ...form, subject_email: e.target.value })}
                placeholder="user@example.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">请求说明</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition-colors">提交</button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200 text-xs px-4 py-2">取消</button>
          </div>
        </div>
      )}

      {/* Requests list */}
      {dsarRequests.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-12 bg-gray-800/30 rounded-xl border border-gray-700">
          暂无 DSAR 请求
        </div>
      ) : (
        <div className="space-y-3">
          {dsarRequests.map((req) => (
            <div key={req.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{req.subject_name}</span>
                    <span className="text-xs text-gray-500">{req.subject_email}</span>
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                      {TYPE_LABELS[req.type]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {req.id} · 租户 {req.tenant_id} · 提交于 {new Date(req.submitted_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <DaysLeft due_at={req.due_at} />
              </div>

              {/* Pipeline */}
              <StatusPipeline status={req.status} />

              {req.description && (
                <p className="text-xs text-gray-400 bg-gray-700/40 rounded-lg px-3 py-2">{req.description}</p>
              )}

              {/* Actions */}
              {req.status !== 'completed' && req.status !== 'rejected' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => advance(req.id, req.status)}
                    className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    推进至下一步
                  </button>
                  <button
                    onClick={() => updateDsarStatus(req.id, 'rejected', '无法核实身份')}
                    className="text-xs bg-red-600/10 hover:bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
