import { Plus } from 'lucide-react';
import { useStore } from '../../store';
import { NodeCard } from './NodeCard';

export function Nodes() {
  const nodeIds = useStore((s) => s.nodes.map((n) => n.id));

  return (
    <div className="animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodeIds.map((id) => (
          <NodeCard key={id} nodeId={id} />
        ))}

        {/* Add node placeholder */}
        <button className="bg-gray-800/50 border border-gray-700 border-dashed rounded-xl p-5 hover:bg-gray-800 hover:border-gray-500 transition-all flex flex-col items-center justify-center text-gray-400 hover:text-gray-200 min-h-[280px] gap-2">
          <Plus size={28} />
          <span className="font-medium text-sm">注册新 vLLM 节点</span>
        </button>
      </div>
    </div>
  );
}
