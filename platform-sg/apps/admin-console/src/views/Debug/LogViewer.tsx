import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import type { LogEntry, LogLevel } from '../../types';

const ROW_HEIGHT = 26; // px — fixed height for every log row
const OVERSCAN   = 8;  // extra rows rendered above/below visible area

// ─── Level badge ──────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: 'text-gray-400',
  info:  'text-blue-400',
  warn:  'text-amber-400',
  error: 'text-red-400',
};

const SOURCE_STYLE: Record<string, string> = {
  litellm:     'text-purple-400',
  'vllm-node-1': 'text-emerald-400',
  'vllm-node-2': 'text-teal-400',
  'vllm-node-3': 'text-cyan-400',
  system:      'text-gray-400',
};

// ─── Single log row (memoised) ────────────────────────────────────────────────

const LogRow = React.memo(function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <div
      className="flex items-start gap-2 px-4 py-0.5 hover:bg-gray-800/60 font-mono text-xs leading-relaxed"
      style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
    >
      <span className="text-gray-600 shrink-0 tabular-nums">
        {entry.timestamp.toLocaleTimeString('zh-CN', { hour12: false })}
      </span>
      <span className={`w-10 shrink-0 font-semibold uppercase ${LEVEL_STYLE[entry.level]}`}>
        {entry.level.slice(0, 4)}
      </span>
      <span className={`w-24 shrink-0 truncate ${SOURCE_STYLE[entry.source] ?? 'text-gray-400'}`}>
        {entry.source}
      </span>
      <span className="text-gray-300 truncate">{entry.message}</span>
    </div>
  );
});

// ─── Virtual-scroll container ─────────────────────────────────────────────────

export function LogViewer() {
  const allEntries  = useStore((s) => s.logEntries);
  const filter      = useStore((s) => s.logFilter);

  const containerRef  = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop]           = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const autoScrollRef = useRef(true);

  // Observe container height changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Filtered entries
  const filtered = useMemo(() => {
    const { levels, sources, search } = filter;
    const q = search.toLowerCase();
    return allEntries.filter(
      (e) =>
        levels.has(e.level) &&
        sources.has(e.source) &&
        (q === '' || e.message.toLowerCase().includes(q)),
    );
  }, [allEntries, filter]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filtered.length]);

  // Virtual window calculation
  const visStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visEnd   = Math.min(
    filtered.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visible     = filtered.slice(visStart, visEnd);
  const paddingTop  = visStart * ROW_HEIGHT;
  const totalHeight = filtered.length * ROW_HEIGHT;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    autoScrollRef.current = atBottom;
  }

  return (
    <div className="flex-1 bg-gray-950 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500">
        <span className="font-mono">
          显示 {filtered.length} / {allEntries.length} 条
          {filter.search && ` · 匹配 "${filter.search}"`}
        </span>
        <button
          onClick={() => {
            autoScrollRef.current = true;
            if (containerRef.current)
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }}
          className="hover:text-gray-300 transition-colors"
        >
          ↓ 滚到底部
        </button>
      </div>

      {/* Virtual list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        style={{ minHeight: 0 }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-500">
            暂无日志条目
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${paddingTop}px)` }}>
              {visible.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
