import { useStore } from '../../store';
import { Shield, Users, FileText, Trash2, AlertTriangle, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface AreaCard {
  key: keyof Omit<import('../../types').ComplianceScore, 'overall'>;
  label: string;
  icon: React.ReactNode;
  description: string;
  requirement: string;
}

const AREAS: AreaCard[] = [
  {
    key: 'privacy_notice',
    label: '隐私通知',
    icon: <Shield size={16} />,
    description: '已展示处理目的与 DPO 联系方式',
    requirement: 'PDPA §20 — 收集前告知',
  },
  {
    key: 'dsar',
    label: '数据主体权利',
    icon: <Users size={16} />,
    description: '30天内响应访问/更正/删除请求',
    requirement: 'PDPA §21–22 — 访问与更正',
  },
  {
    key: 'consent',
    label: '同意管理',
    icon: <FileText size={16} />,
    description: '有效同意记录及撤回机制',
    requirement: 'PDPA §13–17 — 同意义务',
  },
  {
    key: 'retention',
    label: '数据保留',
    icon: <Trash2 size={16} />,
    description: '超期数据定期自动清除',
    requirement: 'PDPA §25 — 保留限制',
  },
  {
    key: 'breach',
    label: '违规响应',
    icon: <AlertTriangle size={16} />,
    description: '3天内通知 PDPC，违规工作流完整',
    requirement: 'PDPA §26D — 数据泄露通知',
  },
];

function ScoreBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-sm font-bold w-8 text-right ${
        value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-yellow-400' : 'text-red-400'
      }`}>{value}</span>
    </div>
  );
}

function StatusIcon({ value }: { value: number }) {
  if (value >= 80) return <CheckCircle size={16} className="text-emerald-400" />;
  if (value >= 60) return <AlertCircle size={16} className="text-yellow-400" />;
  return <XCircle size={16} className="text-red-400" />;
}

export function ScorePanel() {
  const score = useStore((s) => s.complianceScore);
  const dsarRequests = useStore((s) => s.dsarRequests);
  const breachIncidents = useStore((s) => s.breachIncidents);
  const retentionStatus = useStore((s) => s.retentionStatus);

  const pending = dsarRequests.filter((d) => d.status === 'pending').length;
  const openBreaches = breachIncidents.filter((b) => b.status !== 'closed').length;

  return (
    <div className="space-y-5">
      {/* Alert bar */}
      {(pending > 0 || openBreaches > 0 || retentionStatus.expired_records > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex flex-wrap gap-4">
          <p className="text-yellow-400 font-semibold text-sm w-full">待处理合规事项</p>
          {pending > 0 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">
              {pending} 条 DSAR 请求待审核
            </span>
          )}
          {retentionStatus.expired_records > 0 && (
            <span className="text-xs bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full">
              {retentionStatus.expired_records} 条审计记录已超期待清除
            </span>
          )}
          {openBreaches > 0 && (
            <span className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded-full">
              {openBreaches} 起未关闭违规事件
            </span>
          )}
        </div>
      )}

      {/* Score cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AREAS.map(({ key, label, icon, description, requirement }) => {
          const value = score[key];
          return (
            <div key={key} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-300 font-medium text-sm">
                  {icon}
                  {label}
                </div>
                <StatusIcon value={value} />
              </div>
              <ScoreBar value={value} />
              <p className="text-xs text-gray-400">{description}</p>
              <p className="text-xs text-gray-600 font-mono">{requirement}</p>
            </div>
          );
        })}

        {/* Overall */}
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 space-y-3 md:col-span-2 xl:col-span-1">
          <p className="text-blue-300 font-semibold text-sm flex items-center gap-2">
            <Shield size={16} /> 总体合规度
          </p>
          <div className="flex items-end gap-3">
            <p className={`text-5xl font-bold ${
              score.overall >= 80 ? 'text-emerald-400' :
              score.overall >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>{score.overall}</p>
            <p className="text-gray-400 mb-1">/100</p>
          </div>
          <ScoreBar value={score.overall} />
          <p className="text-xs text-gray-500">
            {score.overall >= 80
              ? '符合 PDPA 基本要求'
              : score.overall >= 60
              ? '部分满足，需继续改进'
              : '存在重大合规缺口，需立即处理'}
          </p>
        </div>
      </div>

      {/* PDPA Process Flow */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-300 mb-4">PDPA 合规流程总览</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { label: '隐私通知', sub: '告知处理目的', done: score.privacy_notice >= 60 },
            { label: '获取同意', sub: '明示/默示同意', done: score.consent >= 60 },
            { label: 'DSAR 响应', sub: '30天内处理', done: score.dsar >= 60 },
            { label: '数据保留', sub: '超期自动清除', done: score.retention >= 60 },
            { label: '违规通知', sub: '3天通知 PDPC', done: score.breach >= 60 },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 shrink-0">
              <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-center min-w-[90px] ${
                step.done
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-red-500/30 bg-red-500/05'
              }`}>
                <span className={`text-lg ${step.done ? 'text-emerald-400' : 'text-red-400'}`}>
                  {step.done ? '✓' : '✗'}
                </span>
                <span className="text-xs font-medium text-gray-200">{step.label}</span>
                <span className="text-xs text-gray-500">{step.sub}</span>
              </div>
              {i < arr.length - 1 && (
                <span className="text-gray-600 text-xl">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
