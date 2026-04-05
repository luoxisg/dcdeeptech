import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useStore } from '../../store';
import { RESPONSE_CORPUS } from '../../mockData';
import type { ChatMessage } from '../../types';

// ─── Message bubble (memo'd — only re-renders when content changes) ───────────

const MessageBubble = React.memo(function MessageBubble({
  msg, isLast, isStreaming,
}: {
  msg: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
}) {
  if (msg.role === 'system') {
    return (
      <div className="text-xs text-gray-500 text-center py-1 bg-gray-800/40 rounded-lg px-3">
        {msg.content}
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-700/60 text-gray-200 border border-gray-600 rounded-bl-none'
        }`}
      >
        {msg.content}
        {isLast && isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 rounded-sm animate-pulse align-middle" />
        )}
        {!isStreaming && msg.latencyMs && (
          <span className="block text-xs mt-1 opacity-50">
            {msg.tokenCount} tokens · {msg.latencyMs}ms · {msg.routedTo}
          </span>
        )}
      </div>
    </div>
  );
});

// ─── Conversation sidebar ─────────────────────────────────────────────────────

function ConversationSidebar() {
  const conversations        = useStore((s) => s.conversations);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const setActive            = useStore((s) => s.setActiveConversation);
  const deleteConv           = useStore((s) => s.deleteConversation);
  const createConv           = useStore((s) => s.createConversation);

  return (
    <div className="w-60 shrink-0 bg-gray-800 border border-gray-700 rounded-xl flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={() => createConv('llama-3')}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> 新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-6">暂无对话历史</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => setActive(conv.id)}
            className={`group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
              conv.id === activeConversationId
                ? 'bg-blue-600/20 text-blue-300'
                : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <MessageSquare size={13} className="shrink-0 mt-0.5 opacity-60" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{conv.title}</p>
              <p className="text-xs text-gray-500 truncate">{conv.model}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-gray-400 transition-all shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats sidebar ────────────────────────────────────────────────────────────

function StatsSidebar({
  stats,
  isGenerating,
}: {
  stats: { route: string; ttft: string; tps: string; cost: string } | null;
  isGenerating: boolean;
}) {
  return (
    <div className="w-64 shrink-0 space-y-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-300 mb-3">实时生成指标</h3>
        {stats ? (
          <div className="space-y-3 text-xs">
            <StatRow label="路由" value={stats.route} color="text-blue-400" />
            <StatRow label="TTFT" value={stats.ttft} />
            <StatRow label="速度" value={`${stats.tps} T/s`} color="text-emerald-400" />
            <div className="h-px bg-gray-700" />
            <StatRow label="计费" value={stats.cost} color="text-amber-400" />
          </div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center py-6 text-emerald-400/60">
            <div className="animate-spin mb-2 text-emerald-400">
              <Play size={20} />
            </div>
            <span className="text-xs">推理中…</span>
          </div>
        ) : (
          <p className="text-xs text-gray-500 text-center py-6">发送消息后查看指标</p>
        )}
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-blue-300 mb-2">架构说明</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          请求经 <strong className="text-gray-200">LiteLLM</strong> 按模型名路由至对应
          <strong className="text-gray-200"> vLLM</strong> 节点，使用 OpenAI 兼容格式，
          并自动记录 token 消耗与成本。
        </p>
      </div>
    </div>
  );
}

function StatRow({
  label, value, color = 'text-gray-200',
}: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}

// ─── Main playground ──────────────────────────────────────────────────────────

export function Playground() {
  const conversations        = useStore((s) => s.conversations);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const streamingState       = useStore((s) => s.streamingState);
  const createConv           = useStore((s) => s.createConversation);
  const appendMsg            = useStore((s) => s.appendMessage);
  const appendToken          = useStore((s) => s.appendToken);
  const setStreamState       = useStore((s) => s.setStreamingState);

  const [input, setInput]   = useState('');
  const [model, setModel]   = useState('llama-3');
  const [stats, setStats]   = useState<{ route: string; ttft: string; tps: string; cost: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isGenerating   = streamingState === 'streaming';

  // Get active conversation
  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isGenerating) return;

    // Ensure an active conversation exists
    let convId = activeConversationId;
    if (!convId) {
      convId = createConv(model);
    }

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    appendMsg(convId, userMsg);
    setInput('');
    setStreamState('streaming');
    setStats(null);

    const responseKey = model as keyof typeof RESPONSE_CORPUS;
    const pool = RESPONSE_CORPUS[responseKey] ?? RESPONSE_CORPUS['llama-3'];
    const response = pool[Math.floor(Math.random() * pool.length)];
    const words = response.split('');

    const assistantMsgId = Math.random().toString(36).slice(2);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    // Short delay before first token (TTFT simulation)
    const ttftMs = model === 'llama-3' ? 42 : 28;
    setTimeout(() => {
      appendMsg(convId!, assistantMsg);

      let i = 0;
      const interval = setInterval(() => {
        if (i < words.length) {
          appendToken(convId!, assistantMsgId, words[i]);
          i++;
        } else {
          clearInterval(interval);
          setStreamState('done');

          const tps = model === 'llama-3' ? 125 : 188;
          setStats({
            route: model === 'llama-3' ? 'LiteLLM → Node A (RTX 4090)' : 'LiteLLM → Node B (A100)',
            ttft: `${ttftMs}ms`,
            tps: `${tps}`,
            cost: `$${(Math.random() * 0.0001).toFixed(6)}`,
          });

          // Update assistant message with final metadata
          // (we can't easily do this without another store action, so we just note it visually)
        }
      }, 18); // ~55 chars/sec
    }, ttftMs);
  }, [input, isGenerating, activeConversationId, model, createConv, appendMsg, appendToken, setStreamState]);

  return (
    <div className="h-full flex gap-4 animate-fade-up" style={{ minHeight: 0 }}>
      {/* Conversation history */}
      <ConversationSidebar />

      {/* Chat window */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between bg-gray-800/80">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">模型:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-gray-900 border border-gray-600 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="llama-3">meta-llama/Llama-3-8b-instruct</option>
              <option value="mistral">mistralai/Mistral-7B-v0.1</option>
            </select>
          </div>
          <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">
            /v1/chat/completions
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!activeConv || activeConv.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <MessageSquare size={36} className="mb-3 opacity-30" />
              <p className="text-sm">开始对话以测试推理性能</p>
              <p className="text-xs mt-1 text-gray-600">支持流式输出 · 实时 token 速率</p>
            </div>
          ) : (
            activeConv.messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isLast={idx === activeConv.messages.length - 1}
                isStreaming={isGenerating}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="输入消息，体验 vLLM 极速推理…"
              disabled={isGenerating}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isGenerating || !input.trim()}
              className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md transition-colors"
            >
              <Play size={15} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats sidebar */}
      <StatsSidebar stats={stats} isGenerating={isGenerating} />
    </div>
  );
}
