import type { NodeStatus } from '../types';

const cfg: Record<NodeStatus, { dot: string; ring: string; label: string }> = {
  running:  { dot: 'bg-emerald-400', ring: 'bg-emerald-400/30', label: '运行中' },
  starting: { dot: 'bg-amber-400',   ring: 'bg-amber-400/30',   label: '启动中' },
  stopped:  { dot: 'bg-gray-500',    ring: '',                  label: '已停止' },
  error:    { dot: 'bg-red-400',     ring: 'bg-red-400/30',     label: '错误'   },
};

interface Props {
  status: NodeStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function StatusIndicator({ status, showLabel = false, size = 'md' }: Props) {
  const { dot, ring, label } = cfg[status];
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const ringSize = size === 'sm' ? 'w-3 h-3'   : 'w-4 h-4';

  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex items-center justify-center">
        {ring && (
          <span className={`absolute rounded-full ${ringSize} ${ring} animate-ping opacity-75`} />
        )}
        <span className={`relative rounded-full ${dotSize} ${dot}`} />
      </span>
      {showLabel && (
        <span className="text-xs text-gray-300">{label}</span>
      )}
    </span>
  );
}
