import { Activity, DollarSign } from 'lucide-react';
import { useStore } from '../store';

const VIEW_LABELS: Record<string, string> = {
  dashboard:  '系统总览与拓扑',
  playground: '推理测试游乐场',
  routing:    '请求路由配置 (LiteLLM)',
  nodes:      '后端工作节点 (vLLM)',
  debug:      '底层硬件与容器调试',
};

export function TopBar() {
  const activeView = useStore((s) => s.activeView);
  const health = useStore((s) => s.health);
  const nodes = useStore((s) => s.nodes);

  const avgTps = nodes
    .filter((n) => n.status === 'running')
    .reduce((sum, n) => sum + n.currentMetric.tps, 0);

  const upDays = Math.floor(health.uptime / 86400);
  const upHours = Math.floor((health.uptime % 86400) / 3600);

  return (
    <header className="h-14 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-8">
      <h2 className="text-lg font-semibold text-gray-100">
        {VIEW_LABELS[activeView]}
      </h2>
      <div className="flex gap-3 items-center">
        <MetricPill
          icon={<Activity size={13} />}
          label="吞吐"
          value={`${avgTps} T/s`}
          color="text-emerald-400"
        />
        <MetricPill
          icon={<DollarSign size={13} />}
          label="本月"
          value="$12.45"
          color="text-blue-400"
        />
        <div className="text-xs text-gray-500 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
          运行 {upDays}d {upHours}h
        </div>
      </div>
    </header>
  );
}

function MetricPill({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700 text-xs">
      <span className={color}>{icon}</span>
      <span className="text-gray-400">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
