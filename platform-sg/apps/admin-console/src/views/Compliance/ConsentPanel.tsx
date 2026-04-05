import { useState } from 'react';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { useStore } from '../../store';
import type { ConsentRecord, ConsentBasis, CreateConsentRequest } from '../../types';

const BASIS_LABELS: Record<ConsentBasis, string> = {
  explicit: '明示同意',
  legitimate_interest: '合法权益',
  contractual: '合同履行',
  withdrawn: '已撤回',
};

const BASIS_COLOR: Record<ConsentBasis, string> = {
  explicit: 'bg-emerald-500/20 text-emerald-300',
  legitimate_interest: 'bg-blue-500/20 text-blue-300',
  contractual: 'bg-purple-500/20 text-purple-300',
  withdrawn: 'bg-red-500/20 text-red-300',
};

export function ConsentPanel() {
  const consentRecords = useStore((s) => s.consentRecords);
  const addConsent = useStore((s) => s.addConsent);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateConsentRequest>({
    tenant_id: '', subject_email: '', purpose: '', basis: 'explicit', granted: true,
  });

  const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

  async function submit() {
    if (!form.subject_email || !form.purpose) return;
    const rec: ConsentRecord = {
      id: `consent_${Math.random().toString(36).slice(2, 10)}`,
      ...form,
      recorded_at: new Date().toISOString(),
      expires_at: form.expires_at ?? null,
      withdrawn_at: null,
    };
    if (GATEWAY_URL) {
      try {
        await fetch(`${GATEWAY_URL}/compliance/consent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
      } catch { /* demo fallback */ }
    }
    addConsent(rec);
    setShowForm(false);
    setForm({ tenant_id: '', subject_email: '', purpose: '', basis: 'explicit', granted: true });
  }

  const granted = consentRecords.filter((r) => r.granted && r.basis !== 'withdrawn').length;
  const withdrawn = consentRecords.filter((r) => !r.granted || r.basis === 'withdrawn').length;

  return (
    <div className="space-y-4">
      {/* Consent framework */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">同意管理框架（PDPA §13–17）</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(BASIS_LABELS) as [ConsentBasis, string][]).map(([basis, label]) => {
            const count = consentRecords.filter((r) => r.basis === basis).length;
            return (
              <div key={basis} className={`px-3 py-2 rounded-lg text-center border ${
                basis === 'withdrawn' ? 'border-red-500/20 bg-red-500/5' : 'border-gray-600 bg-gray-700/30'
              }`}>
                <p className={`text-lg font-bold ${basis === 'withdrawn' ? 'text-red-400' : 'text-gray-200'}`}>{count}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle size={14} /> {granted} 有效
          </span>
          <span className="text-red-400 flex items-center gap-1">
            <XCircle size={14} /> {withdrawn} 已撤回/无效
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> 记录同意
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-800/60 border border-blue-500/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-300">记录同意</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">租户 ID</label>
              <input value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                placeholder="tenant-acme" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">数据主体邮箱</label>
              <input value={form.subject_email} onChange={(e) => setForm({ ...form, subject_email: e.target.value })}
                placeholder="user@example.com" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">同意依据</label>
              <select value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value as ConsentBasis })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200">
                {(Object.entries(BASIS_LABELS) as [ConsentBasis, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">状态</label>
              <select value={form.granted ? 'true' : 'false'} onChange={(e) => setForm({ ...form, granted: e.target.value === 'true' })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200">
                <option value="true">已授权</option>
                <option value="false">已撤回 / 拒绝</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">处理目的</label>
            <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="AI 推理服务个性化分析" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200" />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition-colors">保存</button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200 text-xs px-4 py-2">取消</button>
          </div>
        </div>
      )}

      {/* Records */}
      {consentRecords.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-12 bg-gray-800/30 rounded-xl border border-gray-700">
          暂无同意记录
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60">
                <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">主体邮箱</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">租户</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">处理目的</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">依据</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">状态</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">记录时间</th>
              </tr>
            </thead>
            <tbody>
              {consentRecords.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{rec.subject_email}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{rec.tenant_id}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-xs max-w-[180px] truncate">{rec.purpose}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${BASIS_COLOR[rec.basis]}`}>
                      {BASIS_LABELS[rec.basis]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {rec.granted && rec.basis !== 'withdrawn'
                      ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} /> 有效</span>
                      : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> 无效</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(rec.recorded_at).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
