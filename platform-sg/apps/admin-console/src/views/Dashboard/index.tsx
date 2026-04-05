import { Database, Zap, DollarSign, Server } from 'lucide-react';
import { useStore } from '../../store';
import { RequestRateChart } from '../../components/charts/RequestRateChart';
import { StatusIndicator } from '../../components/StatusIndicator';

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow() {
  const health = useStore((s) => s.health);
  const nodes  = useStore((s) => s.nodes);
  const onlineCount = nodes.filter((n) => n.status === 'running').length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        title="总请求数"
        value={`${(health.totalRequests / 1_000_000).toFixed(2)}M`}
        sub="+12% 较上周"
        icon={<Database size={18} className="text-blue-400" />}
      />
      <StatCard
        title="平均 TTFT"
        value="62ms"
        sub="PagedAttention 加速"
        icon={<Zap size={18} className="text-amber-400" />}
      />
      <StatCard
        title="成本节约"
        value="$45.20"
        sub="LiteLLM 缓存命中"
        icon={<DollarSign size={18} className="text-emerald-400" />}
      />
      <StatCard
        title="在线节点"
        value={`${onlineCount} / ${nodes.length}`}
        sub="GPU 节点状态"
        icon={<Server size={18} className="text-purple-400" />}
      />
    </div>
  );
}

function StatCard({
  title, value, sub, icon,
}: {
  title: string; value: string; sub: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <div className="flex justify-between items-start mb-2">
        <p className="text-gray-400 text-sm">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

// ─── Topology SVG ─────────────────────────────────────────────────────────────

function TopologyGraph() {
  const nodes = useStore((s) => s.nodes);

  const nodePositions = [
    { x: 100, y: 230 },
    { x: 300, y: 230 },
    { x: 500, y: 230 },
  ];

  const statusColor: Record<string, string> = {
    running: '#10b981',
    starting: '#f59e0b',
    stopped: '#6b7280',
    error: '#ef4444',
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">实时系统架构拓扑</h3>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 600 280" className="w-full" style={{ minWidth: 480 }}>
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
            </linearGradient>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" opacity="0.6" />
            </marker>
          </defs>

          {/* Client → Gateway */}
          <path d="M 130 60 Q 210 110 285 130" stroke="url(#lineGrad)" strokeWidth="1.5"
            fill="none" strokeDasharray="5 3" className="animate-dash" />
          <path d="M 470 60 Q 390 110 315 130" stroke="url(#lineGrad)" strokeWidth="1.5"
            fill="none" strokeDasharray="5 3" className="animate-dash" />

          {/* Gateway → Nodes */}
          {nodePositions.map((pos, i) => (
            <path
              key={i}
              d={`M 300 170 Q ${(300 + pos.x) / 2} ${(170 + pos.y) / 2} ${pos.x} ${pos.y - 22}`}
              stroke={nodes[i] ? statusColor[nodes[i].status] : '#6b7280'}
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="5 3"
              opacity={nodes[i]?.status === 'stopped' ? 0.3 : 0.8}
              className={nodes[i]?.status === 'running' ? 'animate-dash' : ''}
            />
          ))}

          {/* Client boxes */}
          {[{ x: 65, y: 25, label: 'Web 客户端' }, { x: 405, y: 25, label: 'Python SDK' }].map((c) => (
            <g key={c.label}>
              <rect x={c.x} y={c.y} width={130} height={38} rx="8"
                fill="#374151" stroke="#4b5563" strokeWidth="1" />
              <text x={c.x + 65} y={c.y + 24} textAnchor="middle"
                fill="#e5e7eb" fontSize="11" fontFamily="system-ui">{c.label}</text>
            </g>
          ))}

          {/* LiteLLM Gateway */}
          <rect x="170" y="115" width="260" height="58" rx="10"
            fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />
          <rect x="170" y="115" width="260" height="58" rx="10"
            fill="#3b82f6" fillOpacity="0.08" />
          <text x="300" y="139" textAnchor="middle" fill="white"
            fontSize="13" fontWeight="bold" fontFamily="system-ui">LiteLLM 网关</text>
          <text x="300" y="158" textAnchor="middle" fill="#93c5fd"
            fontSize="10" fontFamily="system-ui">:4000 · 负载均衡 · 成本控制 · 重试</text>

          {/* vLLM Nodes */}
          {nodes.map((node, i) => {
            const { x, y } = nodePositions[i];
            const color = statusColor[node.status];
            const online = node.status === 'running';
            return (
              <g key={node.id}>
                <rect x={x - 70} y={y - 22} width={140} height={62} rx="8"
                  fill={online ? '#064e3b' : '#1f2937'}
                  stroke={color} strokeWidth={online ? 1.5 : 1}
                  opacity={online ? 1 : 0.6} />
                <circle cx={x - 52} cy={y - 2} r="4" fill={color} opacity="0.9" />
                {online && (
                  <circle cx={x - 52} cy={y - 2} r="7" fill={color} fillOpacity="0.2">
                    <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <text x={x - 40} y={y - 3} fill={online ? '#d1fae5' : '#9ca3af'}
                  fontSize="11" fontWeight="bold" fontFamily="system-ui">{node.name}</text>
                <text x={x} y={y + 15} textAnchor="middle" fill="#6b7280"
                  fontSize="9" fontFamily="monospace">
                  {node.model.split('/').pop()?.slice(0, 24)}
                </text>
                {online && (
                  <text x={x} y={y + 30} textAnchor="middle" fill="#34d399"
                    fontSize="9" fontFamily="monospace">
                    {node.currentMetric.tps} T/s · {node.currentMetric.utilization}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Request rate panel ───────────────────────────────────────────────────────

function RequestRatePanel() {
  const health = useStore((s) => s.health);
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-300">请求速率 (5s 采样)</h3>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>错误率: <span className="text-red-400">{(health.errorRate * 100).toFixed(2)}%</span></span>
          <span>队列深度: <span className="text-amber-400">{health.queueDepth}</span></span>
          <span>活跃连接: <span className="text-blue-400">{health.activeConnections}</span></span>
        </div>
      </div>
      <RequestRateChart data={health.reqRateHistory} />
    </div>
  );
}

// ─── Live nodes summary ────────────────────────────────────────────────────────

function NodeSummaryRow() {
  const nodes = useStore((s) => s.nodes);
  return (
    <div className="grid grid-cols-3 gap-4">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-3"
        >
          <StatusIndicator status={node.status} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{node.name}</p>
            <p className="text-xs text-gray-500 truncate">{node.gpuLabel}</p>
          </div>
          {node.status === 'running' && (
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-emerald-400">
                {node.currentMetric.utilization}%
              </p>
              <p className="text-xs text-gray-500">GPU</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── View root ────────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-up">
      <StatsRow />
      <TopologyGraph />
      <div className="grid grid-cols-2 gap-6">
        <RequestRatePanel />
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">节点实时状态</h3>
          <NodeSummaryRow />
        </div>
      </div>
    </div>
  );
}
