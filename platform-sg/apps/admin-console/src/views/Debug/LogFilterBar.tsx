import { useEffect, useState } from 'react';
import { Search, Trash2, Download } from 'lucide-react';
import { useStore } from '../../store';
import type { LogLevel, LogSource } from '../../types';

const LEVELS: { id: LogLevel; label: string; color: string }[] = [
  { id: 'debug', label: 'DEBUG', color: 'text-gray-400 border-gray-600 bg-gray-700/50 hover:bg-gray-700' },
  { id: 'info',  label: 'INFO',  color: 'text-blue-400  border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20' },
  { id: 'warn',  label: 'WARN',  color: 'text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20' },
  { id: 'error', label: 'ERROR', color: 'text-red-400   border-red-500/40 bg-red-500/10 hover:bg-red-500/20' },
];

const SOURCES: { id: LogSource; label: string }[] = [
  { id: 'litellm',     label: 'LiteLLM' },
  { id: 'vllm-node-1', label: 'Node A'  },
  { id: 'vllm-node-2', label: 'Node B'  },
  { id: 'vllm-node-3', label: 'Node C'  },
  { id: 'system',      label: 'System'  },
];

export function LogFilterBar() {
  const filter    = useStore((s) => s.logFilter);
  const setFilter = useStore((s) => s.setLogFilter);
  const clearLogs = useStore((s) => s.clearLogs);
  const entries   = useStore((s) => s.logEntries);

  const [searchInput, setSearchInput] = useState('');

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setFilter({ search: searchInput }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilter]);

  function toggleLevel(level: LogLevel) {
    const levels = new Set(filter.levels);
    levels.has(level) ? levels.delete(level) : levels.add(level);
    setFilter({ levels });
  }

  function toggleSource(source: LogSource) {
    const sources = new Set(filter.sources);
    sources.has(source) ? sources.delete(source) : sources.add(source);
    setFilter({ sources });
  }

  function handleExport() {
    const text = entries
      .filter(
        (e) =>
          filter.levels.has(e.level) &&
          filter.sources.has(e.source) &&
          (filter.search === '' || e.message.toLowerCase().includes(filter.search.toLowerCase())),
      )
      .map((e) => `[${e.timestamp.toISOString()}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gateway-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Level toggles */}
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => toggleLevel(l.id)}
              className={`text-xs px-2.5 py-1 rounded border font-mono font-medium transition-all ${l.color} ${
                filter.levels.has(l.id) ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {l.label}
            </button>
          ))}

          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Source toggles */}
          {SOURCES.map((src) => (
            <button
              key={src.id}
              onClick={() => toggleSource(src.id)}
              className={`text-xs px-2.5 py-1 rounded border text-gray-300 border-gray-600 bg-gray-700/50 hover:bg-gray-700 transition-all ${
                filter.sources.has(src.id) ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
            title="导出日志"
          >
            <Download size={15} />
          </button>
          <button
            onClick={clearLogs}
            className="p-2 hover:bg-red-900/40 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
            title="清空日志"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Text search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索日志内容..."
          className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-8 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
