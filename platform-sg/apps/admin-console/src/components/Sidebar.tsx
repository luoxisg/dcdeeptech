import { Activity, KeyRound, MessageSquare, Route, Server, Shield, Terminal, Zap } from 'lucide-react';
import { useStore } from '../store';
import type { ActiveView } from '../types';

const NAV_ITEMS: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',  label: '总览拓扑',         icon: <Activity size={18} /> },
  { id: 'playground', label: '聊天测试',          icon: <MessageSquare size={18} /> },
  { id: 'routing',    label: '路由与负载均衡',    icon: <Route size={18} /> },
  { id: 'nodes',      label: 'vLLM 节点管理',    icon: <Server size={18} /> },
  { id: 'debug',      label: '底层与容器调试',    icon: <Terminal size={18} /> },
  { id: 'keys',       label: 'API Key 管理',      icon: <KeyRound size={18} /> },
  { id: 'compliance', label: 'PDPA 合规',          icon: <Shield size={18} /> },
];

export function Sidebar() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const nodes = useStore((s) => s.nodes);
  const onlineCount = nodes.filter((n) => n.status === 'running').length;

  return (
    <div className="w-64 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight tracking-wide">AI Gateway</h1>
          <p className="text-xs text-gray-400">LiteLLM + vLLM</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
        <span>v1.0.0-beta</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {onlineCount} 节点在线
        </span>
      </div>
    </div>
  );
}
