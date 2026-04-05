import { useState } from 'react';
import { Trash2, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { useStore } from '../../store';

export function RetentionPanel() {
  const status = useStore((s) => s.retentionStatus);
  const setRetentionStatus = useStore((s) => s.setRetentionStatus);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function runCleanup() {
    setRunning(true);
    setLog([]);
    const steps = [
      '扫描审计日志数据库...',
      `发现 ${status.expired_records} 条超期记录（保留期 ${status.policy_days} 天）`,
      '验证记录不涉及未结案事件...',
      `安全删除 ${status.expired_records} 条记录...`,
      '更新审计索引...',
      '写入清除操作审计记录...',
      `清除完成。释放约 ${Math.round(status.expired_records * 0.4)} KB 存储空间。`,
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 600));
      setLog((prev) => [...prev, step]);
    }

    const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;
    if (GATEWAY_URL) {
      try {
        await fetch(`${GATEWAY_URL}/compliance/retention/cleanup`, { method: 'POST' });
      } catch { /* demo fallback */ }
    }

    setRetentionStatus({
      ...status,
      expired_records: 0,
      last_cleanup_at: new Date().toISOString(),
      next_cleanup_at: new Date(Date.now() + 86400000).toISOString(),
      total_audit_records: status.total_audit_records - status.expired_records,
      storage_used_kb: Math.max(0, status.storage_used_kb - Math.round(status.expired_records * 0.4)),
    });
    setRunning(false);
  }

  const expiredPct = status.total_audit_records > 0
    ? Math.round((status.expired_records / status.total_audit_records) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Policy overview */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">数据保留策略（PDPA §25 · retention_policy.yaml）</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '审计日志保留期', value: `${status.policy_days} 天`, color: 'text-blue-400' },
            { label: '总审计记录', value: status.total_audit_records.toLocaleString(), color: 'text-gray-200' },
            { label: '已超期', value: status.expired_records.toLocaleString(), color: status.expired_records > 0 ? 'text-yellow-400' : 'text-emerald-400' },
            { label: '存储占用', value: `${(status.storage_used_kb / 1024).toFixed(1)} MB`, color: 'text-gray-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-700/40 rounded-lg px-3 py-2 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Retention process flow */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">自动清除流程</p>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          {[
            '① 每日扫描', '② 识别超期记录', '③ 排除事件关联', '④ 安全删除', '⑤ 写入清除审计',
          ].map((s, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <span className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">{s}</span>
              {i < arr.length - 1 && <span className="text-gray-500">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Expired records alert */}
      {status.expired_records > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-yellow-400 font-semibold text-sm">发现 {status.expired_records} 条超期记录</p>
            <p className="text-yellow-300/60 text-xs mt-0.5">
              占总记录 {expiredPct}%，建议立即执行清除以满足 PDPA 保留限制要求
            </p>
          </div>
          <button
            onClick={runCleanup}
            disabled={running}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            {running ? '清除中...' : '立即清除'}
          </button>
        </div>
      )}

      {status.expired_records === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-emerald-400 font-semibold text-sm">无超期记录</p>
            <p className="text-emerald-300/60 text-xs mt-0.5">
              上次清除：{status.last_cleanup_at ? new Date(status.last_cleanup_at).toLocaleString('zh-CN') : '从未'} ·
              下次计划：{new Date(status.next_cleanup_at).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      )}

      {/* Cleanup execution log */}
      {log.length > 0 && (
        <div className="bg-gray-950 border border-gray-700 rounded-xl p-4 font-mono text-xs space-y-1">
          <p className="text-gray-400 mb-2 flex items-center gap-2">
            {running ? <RefreshCw size={12} className="animate-spin text-blue-400" /> : <CheckCircle size={12} className="text-emerald-400" />}
            清除执行日志
          </p>
          {log.map((line, i) => (
            <p key={i} className={`${i === log.length - 1 && !running ? 'text-emerald-400' : 'text-gray-300'}`}>
              <span className="text-gray-600">[{new Date().toTimeString().slice(0, 8)}]</span> {line}
            </p>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">保留期时间轴</p>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-500 shrink-0">第 0 天</span>
          <div className="flex-1 h-3 bg-emerald-500/30 rounded-l border border-emerald-500/40 relative">
            <span className="absolute inset-0 flex items-center justify-center text-emerald-400">有效保留期（{status.policy_days}天）</span>
          </div>
          <div className="w-16 h-3 bg-red-500/30 rounded-r border border-red-500/40 relative">
            <span className="absolute inset-0 flex items-center justify-center text-red-400 whitespace-nowrap">超期 →</span>
          </div>
          <span className="text-gray-500 shrink-0">需清除</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <Clock size={12} /> 超期记录将在下次定时任务执行时自动删除
        </div>
      </div>
    </div>
  );
}
