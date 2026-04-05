import { create } from 'zustand';
import type {
  ActiveView, VllmNode, NodeStatus, GpuMetric,
  LiteLLMRoute, GatewayHealth,
  LogEntry, LogFilter, LogLevel, LogSource,
  Conversation, ChatMessage, StreamingState,
  DsarRequest, ConsentRecord, BreachIncident, RetentionStatus, ComplianceScore,
} from './types';
import { INITIAL_NODES, INITIAL_ROUTES, INITIAL_HEALTH } from './mockData';

const ALL_LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);
const ALL_SOURCES = new Set<LogSource>(['litellm', 'vllm-node-1', 'vllm-node-2', 'vllm-node-3', 'system']);

interface AppState {
  // ── UI ──────────────────────────────────────────────────────────────────────
  activeView: ActiveView;
  sidebarCollapsed: boolean;
  setActiveView: (view: ActiveView) => void;
  toggleSidebar: () => void;

  // ── Nodes ────────────────────────────────────────────────────────────────────
  nodes: VllmNode[];
  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;
  appendNodeMetric: (nodeId: string, metric: GpuMetric) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;

  // ── Gateway ──────────────────────────────────────────────────────────────────
  routes: LiteLLMRoute[];
  health: GatewayHealth;
  updateHealth: (patch: Partial<GatewayHealth>) => void;
  appendReqRate: (requests: number, errors: number) => void;

  // ── Logs ─────────────────────────────────────────────────────────────────────
  logEntries: LogEntry[];
  logFilter: LogFilter;
  appendLog: (entry: LogEntry) => void;
  setLogFilter: (patch: Partial<LogFilter>) => void;
  clearLogs: () => void;

  // ── Playground ───────────────────────────────────────────────────────────────
  conversations: Conversation[];
  activeConversationId: string | null;
  streamingState: StreamingState;
  setActiveConversation: (id: string | null) => void;
  createConversation: (model: string) => string;
  appendMessage: (convId: string, msg: ChatMessage) => void;
  appendToken: (convId: string, msgId: string, token: string) => void;
  setStreamingState: (state: StreamingState) => void;
  deleteConversation: (id: string) => void;

  // ── PDPA Compliance ──────────────────────────────────────────────────────────
  dsarRequests: DsarRequest[];
  consentRecords: ConsentRecord[];
  breachIncidents: BreachIncident[];
  retentionStatus: RetentionStatus;
  complianceScore: ComplianceScore;
  addDsar: (req: DsarRequest) => void;
  updateDsarStatus: (id: string, status: DsarRequest['status'], notes?: string) => void;
  addConsent: (rec: ConsentRecord) => void;
  addBreach: (inc: BreachIncident) => void;
  updateBreachStatus: (id: string, status: BreachIncident['status'], patch?: Partial<BreachIncident>) => void;
  setRetentionStatus: (s: RetentionStatus) => void;
}

export const useStore = create<AppState>()((set) => ({
  // ── UI ──────────────────────────────────────────────────────────────────────
  activeView: 'dashboard',
  sidebarCollapsed: false,
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ── Nodes ────────────────────────────────────────────────────────────────────
  nodes: INITIAL_NODES,
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  appendNodeMetric: (nodeId, metric) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const history =
          n.history.length >= 60
            ? [...n.history.slice(1), metric]
            : [...n.history, metric];
        return { ...n, currentMetric: metric, history };
      }),
    })),
  updateNodeStatus: (nodeId, status) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, status } : n)),
    })),

  // ── Gateway ──────────────────────────────────────────────────────────────────
  routes: INITIAL_ROUTES,
  health: INITIAL_HEALTH,
  updateHealth: (patch) =>
    set((s) => ({ health: { ...s.health, ...patch } })),
  appendReqRate: (requests, errors) =>
    set((s) => {
      const history = [
        ...s.health.reqRateHistory.slice(-59),
        { timestamp: Date.now(), requests, errors },
      ];
      return { health: { ...s.health, reqRateHistory: history } };
    }),

  // ── Logs ─────────────────────────────────────────────────────────────────────
  logEntries: [],
  logFilter: { levels: ALL_LEVELS, sources: ALL_SOURCES, search: '' },
  appendLog: (entry) =>
    set((s) => {
      const entries =
        s.logEntries.length >= 2000
          ? [...s.logEntries.slice(1), entry]
          : [...s.logEntries, entry];
      return { logEntries: entries };
    }),
  setLogFilter: (patch) =>
    set((s) => ({ logFilter: { ...s.logFilter, ...patch } })),
  clearLogs: () => set({ logEntries: [] }),

  // ── Playground ───────────────────────────────────────────────────────────────
  conversations: [],
  activeConversationId: null,
  streamingState: 'idle',
  setActiveConversation: (id) => set({ activeConversationId: id }),
  createConversation: (model) => {
    const id = Math.random().toString(36).slice(2);
    const conv: Conversation = {
      id,
      title: '新对话',
      messages: [],
      model,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }));
    return id;
  },
  appendMessage: (convId, msg) =>
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== convId) return c;
        const messages = [...c.messages, msg];
        // Auto-title from first user message
        const title =
          c.title === '新对话' && msg.role === 'user'
            ? msg.content.slice(0, 40)
            : c.title;
        return { ...c, messages, title, updatedAt: new Date() };
      }),
    })),
  appendToken: (convId, msgId, token) =>
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === msgId ? { ...m, content: m.content + token } : m,
          ),
        };
      }),
    })),
  setStreamingState: (state) => set({ streamingState: state }),
  deleteConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    })),

  // ── PDPA Compliance ──────────────────────────────────────────────────────────
  dsarRequests: [],
  consentRecords: [],
  breachIncidents: [],
  retentionStatus: {
    policy_days: 90,
    total_audit_records: 4821,
    expired_records: 312,
    last_cleanup_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    next_cleanup_at: new Date(Date.now() + 86400000).toISOString(),
    storage_used_kb: 2048,
  },
  complianceScore: {
    overall: 62,
    privacy_notice: 80,
    dsar: 50,
    consent: 60,
    retention: 70,
    breach: 40,
  },
  addDsar: (req) => set((s) => ({ dsarRequests: [req, ...s.dsarRequests] })),
  updateDsarStatus: (id, status, notes) =>
    set((s) => ({
      dsarRequests: s.dsarRequests.map((r) =>
        r.id !== id ? r : {
          ...r, status,
          notes: notes ?? r.notes,
          resolved_at: ['completed', 'rejected'].includes(status) ? new Date().toISOString() : r.resolved_at,
        }
      ),
    })),
  addConsent: (rec) => set((s) => ({ consentRecords: [rec, ...s.consentRecords] })),
  addBreach: (inc) => set((s) => ({ breachIncidents: [inc, ...s.breachIncidents] })),
  updateBreachStatus: (id, status, patch) =>
    set((s) => ({
      breachIncidents: s.breachIncidents.map((b) =>
        b.id !== id ? b : { ...b, status, ...patch }
      ),
    })),
  setRetentionStatus: (rs) => set({ retentionStatus: rs }),
}));
