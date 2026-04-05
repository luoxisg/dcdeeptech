import React, { useState } from 'react';
import { X, Thermometer, Zap, Activity } from 'lucide-react';
import { useStore } from '../../store';
import { StatusIndicator } from '../../components/StatusIndicator';
import { GpuUtilChart } from '../../components/charts/GpuUtilChart';

// ─── Detail modal ─────────────────────────────────────────────────────────────

function NodeDetailModal({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === nodeId));
  if (!node) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-100">{node.name}</h3>
            <p className="text-sm text-gray-400 mt-0.5">{node.gpuLabel} · {node.host}:{node.port}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Model */}
        <div className="bg-gray-800 rounded-lg px-3 py-2 font-mono text-xs text-blue-300 mb-6 border border-gray-700">
          {node.model}
        </div>

        {/* Full chart */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-2">GPU 利用率 (60s)</p>
          <GpuUtilChart history={node.history} mini={false} />
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'VRAM',   value: `${node.currentMetric.vramUsedGb}/${node.currentMetric.vramTotalGb} GB`, color: 'text-amber-400' },
            { label: '温度',   value: `${node.currentMetric.temperatureC}°C`,  color: node.currentMetric.temperatureC > 80 ? 'text-red-400' : 'text-blue-300' },
            { label: '功耗',   value: `${node.currentMetric.powerWatts}W`,      color: 'text-purple-400' },
            { label: '吞吐',   value: `${node.currentMetric.tps} T/s`,          color: 'text-emerald-400' },
            { label: '飞行中', value: `${node.requestsInFlight} 个请求`,         color: 'text-gray-300' },
            { label: '已服务', value: node.totalServed.toLocaleString(),          color: 'text-gray-300' },
            { label: 'TTFT',  value: node.status === 'running' ? `${node.avgTtft}ms` : '-', color: 'text-gray-300' },
            { label: 'GPU 数', value: `${node.gpuCount}`,                         color: 'text-gray-300' },
          ].map((m) => (
            <div key={m.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className={`text-sm font-semibold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
  nodeId: string;
}

export const NodeCard = React.memo(function NodeCard({ nodeId }: Props) {
  const node = useStore((s) => s.nodes.find((n) => n.id === nodeId));
  const [showDetail, setShowDetail] = useState(false);

  if (!node) return null;

  const online = node.status === 'running';
  const vramPct = Math.round(
    (node.currentMetric.vramUsedGb / node.currentMetric.vramTotalGb) * 100,
  );

  return (
    <>
      <div className={`bg-gray-800 border rounded-xl p-5 flex flex-col transition-colors ${
        online ? 'border-gray-700 hover:border-emerald-500/40' : 'border-gray-700 opacity-70'
      }`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <StatusIndicator status={node.status} />
            <div>
              <h4 className="font-semibold text-gray-200 text-sm">{node.name}</h4>
              <p className="text-xs text-gray-500">{node.id}</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            online
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-gray-700 border-gray-600 text-gray-400'
          }`}>
            {online ? '运行中' : node.status === 'starting' ? '启动中' : node.status === 'error' ? '错误' : '已停止'}
          </span>
        </div>

        {/* Model */}
        <p className="font-mono text-xs bg-gray-900 border border-gray-700 px-2 py-1.5 rounded mb-4 text-blue-300 truncate">
          {node.model}
        </p>

        {/* Mini GPU chart */}
        {online && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>GPU 利用率</span>
              <span className="text-indigo-400 font-medium">{node.currentMetric.utilization}%</span>
            </div>
            <GpuUtilChart history={node.history} mini />
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MetricItem label="硬件" value={node.gpuLabel} />
          <MetricItem
            label="吞吐"
            value={online ? `${node.currentMetric.tps} T/s` : '-'}
            color="text-emerald-400"
          />
          <MetricItem
            label="VRAM"
            value={online ? `${node.currentMetric.vramUsedGb}/${node.currentMetric.vramTotalGb}G` : '-'}
            color={vramPct > 85 ? 'text-red-400' : 'text-amber-400'}
          />
          <MetricItem
            label="温度"
            value={online ? `${node.currentMetric.temperatureC}°C` : '-'}
            color={node.currentMetric.temperatureC > 80 ? 'text-red-400' : 'text-blue-300'}
            icon={online ? <Thermometer size={11} /> : undefined}
          />
        </div>

        {/* VRAM bar */}
        {online && (
          <div className="mb-4">
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  vramPct > 85 ? 'bg-red-500' : vramPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${vramPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">VRAM {vramPct}%</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-700 pt-3 flex gap-2 mt-auto">
          <button
            onClick={() => setShowDetail(true)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Activity size={13} /> 详情
          </button>
          <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">
            <Zap size={13} /> 重启
          </button>
        </div>
      </div>

      {showDetail && (
        <NodeDetailModal nodeId={nodeId} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
});

function MetricItem({
  label, value, color = 'text-gray-200', icon,
}: {
  label: string; value: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xs font-semibold flex items-center gap-0.5 ${color}`}>
        {icon}{value}
      </p>
    </div>
  );
}
