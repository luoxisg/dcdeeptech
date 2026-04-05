// ─── View / UI ──────────────────────────────────────────────────────────────
export type ActiveView = 'dashboard' | 'playground' | 'routing' | 'nodes' | 'debug' | 'keys' | 'compliance';

// ─── vLLM Nodes ──────────────────────────────────────────────────────────────
export type NodeStatus = 'running' | 'starting' | 'stopped' | 'error';

export interface GpuMetric {
  timestamp: number;       // unix ms
  utilization: number;     // 0–100
  vramUsedGb: number;
  vramTotalGb: number;
  temperatureC: number;
  powerWatts: number;
  tps: number;             // tokens/sec
}

export interface VllmNode {
  id: string;
  name: string;
  host: string;
  port: number;
  status: NodeStatus;
  model: string;
  gpuLabel: string;
  gpuCount: number;
  currentMetric: GpuMetric;
  history: GpuMetric[];    // 60-point ring buffer
  requestsInFlight: number;
  totalServed: number;
  avgTtft: number;         // ms
}

// ─── LiteLLM Routes ──────────────────────────────────────────────────────────
export type RouteStatus = 'active' | 'degraded' | 'down';

export interface LiteLLMRoute {
  id: string;
  modelMatch: string;
  target: string;
  provider: 'vllm' | 'openai' | 'anthropic';
  status: RouteStatus;
  rpmLimit: number;
  currentRpm: number;
  avgLatencyMs: number;
  errorRate: number;       // 0–1
}

export interface GatewayHealth {
  uptime: number;           // seconds
  totalRequests: number;
  errorRate: number;
  queueDepth: number;
  activeConnections: number;
  reqRateHistory: { timestamp: number; requests: number; errors: number }[];
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'litellm' | 'vllm-node-1' | 'vllm-node-2' | 'vllm-node-3' | 'system';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: LogSource;
  message: string;
}

export interface LogFilter {
  levels: Set<LogLevel>;
  sources: Set<LogSource>;
  search: string;
}

// ─── Playground ───────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';
export type StreamingState = 'idle' | 'streaming' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  model?: string;
  tokenCount?: number;
  latencyMs?: number;
  routedTo?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DCDeepTech API Keys ──────────────────────────────────────────────────────
export type ApiKeyStatus = 'active' | 'disabled' | 'revoked' | 'expired';

export type ApiKeyScope =
  | 'chat:completions'
  | 'embeddings'
  | 'admin:keys'
  | 'admin:tenants'
  | 'internal:routing';

export interface ApiKeyRecord {
  key_id: string;
  key_prefix: string;    // e.g. "sk-dcdt-AbCdEf..." — non-secret, for display
  tenant_id: string;
  description: string;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  created_at: string;    // ISO-8601
  expires_at: string | null;
  last_used_at: string | null;
}

export interface CreateKeyRequest {
  tenant_id: string;
  description: string;
  scopes: ApiKeyScope[];
  expires_at?: string | null;
}

// ─── PDPA Compliance ──────────────────────────────────────────────────────────

export type DsarStatus = 'pending' | 'verifying' | 'processing' | 'completed' | 'rejected';
export type DsarType = 'access' | 'correction' | 'deletion' | 'withdrawal';

export interface DsarRequest {
  id: string;
  type: DsarType;
  subject_name: string;
  subject_email: string;
  tenant_id: string;
  description: string;
  status: DsarStatus;
  submitted_at: string;    // ISO-8601
  due_at: string;          // ISO-8601 — 30 days from submission (PDPA requirement)
  resolved_at: string | null;
  notes: string;
}

export type ConsentBasis = 'explicit' | 'legitimate_interest' | 'contractual' | 'withdrawn';

export interface ConsentRecord {
  id: string;
  tenant_id: string;
  subject_email: string;
  purpose: string;
  basis: ConsentBasis;
  granted: boolean;
  recorded_at: string;
  expires_at: string | null;
  withdrawn_at: string | null;
}

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BreachStatus = 'detected' | 'assessing' | 'notified_internal' | 'notified_pdpc' | 'notified_affected' | 'closed';

export interface BreachIncident {
  id: string;
  title: string;
  severity: BreachSeverity;
  status: BreachStatus;
  detected_at: string;
  description: string;
  affected_count: number;
  // PDPA requires notifying PDPC within 3 days for significant breaches
  pdpc_deadline: string;
  notified_pdpc_at: string | null;
  notified_affected_at: string | null;
  closed_at: string | null;
}

export interface RetentionStatus {
  policy_days: number;
  total_audit_records: number;
  expired_records: number;
  last_cleanup_at: string | null;
  next_cleanup_at: string;
  storage_used_kb: number;
}

export interface ComplianceScore {
  overall: number;          // 0–100
  privacy_notice: number;
  dsar: number;
  consent: number;
  retention: number;
  breach: number;
}

export interface CreateDsarRequest {
  type: DsarType;
  subject_name: string;
  subject_email: string;
  tenant_id: string;
  description: string;
}

export interface CreateBreachRequest {
  title: string;
  severity: BreachSeverity;
  description: string;
  affected_count: number;
}

export interface CreateConsentRequest {
  tenant_id: string;
  subject_email: string;
  purpose: string;
  basis: ConsentBasis;
  granted: boolean;
  expires_at?: string | null;
}

export interface CreateKeyResponse {
  key_id: string;
  key: string;           // Full key — shown ONCE; must be stored securely
  key_prefix: string;
  tenant_id: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  message: string;
}
