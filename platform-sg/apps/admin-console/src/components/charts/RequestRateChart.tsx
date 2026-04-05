import React, { useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

interface DataPoint {
  timestamp: number;
  requests: number;
  errors: number;
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
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

interface Props {
  data: DataPoint[];
}

export const RequestRateChart = React.memo(function RequestRateChart({ data }: Props) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        time: new Date(d.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        requests: d.requests,
        errors: d.errors,
      })),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickCount={4}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4b5563', strokeWidth: 1 }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="requests" name="请求/s" fill="#10b981" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
        <Line
          type="monotone"
          dataKey="errors"
          name="错误/s"
          stroke="#ef4444"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
