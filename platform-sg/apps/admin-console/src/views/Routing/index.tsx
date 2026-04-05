import React, { useMemo, useState } from 'react';
import { Plus, Settings, CheckCircle2, AlertCircle, XCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useStore } from '../../store';
import type { LiteLLMRoute, RouteStatus } from '../../types';

type SortKey = keyof Pick<LiteLLMRoute, 'modelMatch' | 'target' | 'currentRpm' | 'avgLatencyMs' | 'errorRate'>;

const STATUS_CFG: Record<RouteStatus, { icon: React.ReactNode; label: string; cls: string }> = {
  active:   { icon: <CheckCircle2 size={12} />, label: '生效中', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  degraded: { icon: <AlertCircle  size={12} />, label: '降级中', cls: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
  down:     { icon: <XCircle      size={12} />, label: '已下线', cls: 'text-red-400    bg-red-500/10    border-red-500/20'    },
};

const PROVIDER_COLOR: Record<string, string> = {
  vllm:      'bg-emerald-500',
  openai:    'bg-blue-500',
  anthropic: 'bg-purple-500',
};

function RouteRow({ route }: { route: LiteLLMRoute }) {
  const { icon, label, cls } = STATUS_CFG[route.status];
  const rpmPct = Math.round((route.currentRpm / route.rpmLimit) * 100);

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
      <td className="px-5 py-3.5">
        <span className="font-mono text-xs bg-gray-900 border border-gray-600 px-2 py-1 rounded text-blue-300">
          {route.modelMatch}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${PROVIDER_COLOR[route.provider] ?? 'bg-gray-500'}`} />
          <span className="text-sm text-gray-300">{route.provider}</span>
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm text-gray-300">{route.target}</td>
      <td className="px-5 py-3.5">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">{route.currentRpm}/{route.rpmLimit}</span>
            <span className={rpmPct > 85 ? 'text-red-400' : 'text-gray-400'}>{rpmPct}%</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full w-24">
            <div
              className={`h-full rounded-full transition-all ${rpmPct > 85 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, rpmPct)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-sm">
        <span className={route.avgLatencyMs > 300 ? 'text-amber-400' : 'text-gray-300'}>
          {route.avgLatencyMs ? `${route.avgLatencyMs}ms` : '-'}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm">
        <span className={route.errorRate > 0.01 ? 'text-red-400' : 'text-gray-300'}>
          {route.status === 'down' ? '-' : `${(route.errorRate * 100).toFixed(2)}%`}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className={`text-xs px-2 py-1 rounded-full border flex items-center w-fit gap-1 ${cls}`}>
          {icon} {label}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors">
          <Settings size={15} />
        </button>
      </td>
    </tr>
  );
}

export function Routing() {
  const routes = useStore((s) => s.routes);
  const [sortKey, setSortKey] = useState<SortKey>('modelMatch');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    return [...routes].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [routes, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="w-3" />;
    return sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  }

  function Th({ label, k }: { label: string; k?: SortKey }) {
    return (
      <th
        className={`px-5 py-3 text-left text-xs font-medium text-gray-400 ${k ? 'cursor-pointer hover:text-gray-200 select-none' : ''}`}
        onClick={() => k && handleSort(k)}
      >
        <span className="flex items-center gap-1">
          {label}
          {k && <SortIcon k={k} />}
        </span>
      </th>
    );
  }

  return (
    <div className="max-w-6xl space-y-5 animate-fade-up">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">
          配置 LiteLLM 如何将请求映射到不同的 vLLM 工作节点。共 {routes.length} 条规则。
        </p>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> 添加路由规则
        </button>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-900/60 border-b border-gray-700">
            <tr>
              <Th label="模型匹配 (model)" k="modelMatch" />
              <Th label="后端类型" />
              <Th label="目标节点" k="target" />
              <Th label="RPM 用量" k="currentRpm" />
              <Th label="平均延迟" k="avgLatencyMs" />
              <Th label="错误率" k="errorRate" />
              <Th label="状态" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((route) => (
              <RouteRow key={route.id} route={route} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
