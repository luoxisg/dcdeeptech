import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { GpuMetric } from '../../types';

interface ChartData {
  time: string;
  util: number;
  vram: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((item, i) => (
        <p key={i} style={{ color: item.color }}>
          {item.name}: {typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
          {item.name === 'GPU%' ? '%' : ' GB'}
        </p>
      ))}
    </div>
  );
}

interface Props {
  history: GpuMetric[];
  mini?: boolean;
}

export const GpuUtilChart = React.memo(function GpuUtilChart({ history, mini = false }: Props) {
  const data: ChartData[] = useMemo(
    () =>
      history.map((m) => ({
        time: new Date(m.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        util: m.utilization,
        vram: m.vramUsedGb,
      })),
    [history],
  );

  return (
    <ResponsiveContainer width="100%" height={mini ? 80 : 180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradUtil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.7} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradVram" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        {!mini && (
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        )}
        {!mini && (
          <XAxis
            dataKey="time"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
        )}
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickCount={mini ? 3 : 5}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: '#4b5563', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="util"
          name="GPU%"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill="url(#gradUtil)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
