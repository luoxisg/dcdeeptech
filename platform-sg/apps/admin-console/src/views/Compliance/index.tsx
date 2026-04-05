import { useState } from 'react';
import { Shield, FileText, Users, Trash2, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { ScorePanel } from './ScorePanel';
import { DsarPanel } from './DsarPanel';
import { ConsentPanel } from './ConsentPanel';
import { RetentionPanel } from './RetentionPanel';
import { BreachPanel } from './BreachPanel';

type Tab = 'overview' | 'dsar' | 'consent' | 'retention' | 'breach';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: '合规总览',     icon: <Shield size={15} /> },
  { id: 'dsar',       label: '数据主体权利', icon: <Users size={15} /> },
  { id: 'consent',    label: '同意管理',     icon: <FileText size={15} /> },
  { id: 'retention',  label: '数据保留',     icon: <Trash2 size={15} /> },
  { id: 'breach',     label: '违规响应',     icon: <AlertTriangle size={15} /> },
];

export function Compliance() {
  const [tab, setTab] = useState<Tab>('overview');
  const score = useStore((s) => s.complianceScore);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield size={20} className="text-blue-400" />
            PDPA 合规中心
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            新加坡个人数据保护法 · 实时过程可视化
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">总体合规评分</p>
            <p className={`text-2xl font-bold ${
              score.overall >= 80 ? 'text-emerald-400' :
              score.overall >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>{score.overall}<span className="text-sm font-normal text-gray-400">/100</span></p>
          </div>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-4 ${
            score.overall >= 80 ? 'border-emerald-500 text-emerald-400' :
            score.overall >= 60 ? 'border-yellow-500 text-yellow-400' : 'border-red-500 text-red-400'
          }`}>
            {score.overall >= 80 ? '✓' : score.overall >= 60 ? '!' : '✗'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              tab === id
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview'  && <ScorePanel />}
      {tab === 'dsar'      && <DsarPanel />}
      {tab === 'consent'   && <ConsentPanel />}
      {tab === 'retention' && <RetentionPanel />}
      {tab === 'breach'    && <BreachPanel />}
    </div>
  );
}
