import type { VllmNode, LiteLLMRoute, GpuMetric, GatewayHealth, LogEntry, LogLevel, LogSource } from './types';

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function generateGpuHistory(
  baseUtil: number,
  vramTotal: number,
  basePower: number,
): GpuMetric[] {
  const history: GpuMetric[] = [];
  let util = baseUtil;
  let vram = vramTotal * 0.62;
  let temp = 58;
  let power = basePower;
  const now = Date.now();

  for (let i = 59; i >= 0; i--) {
    util = clamp(util + (Math.random() - 0.5) * 10, 15, 99);
    vram = clamp(vram + (Math.random() - 0.5) * 0.4, vramTotal * 0.35, vramTotal * 0.93);
    temp = clamp(temp + (Math.random() - 0.5) * 2, 40, 88);
    power = clamp(power + (Math.random() - 0.5) * 25, 80, basePower * 1.1);
    history.push({
      timestamp: now - i * 1000,
      utilization: Math.round(util),
      vramUsedGb: parseFloat(vram.toFixed(1)),
      vramTotalGb: vramTotal,
      temperatureC: Math.round(temp),
      powerWatts: Math.round(power),
      tps: Math.round(util * 1.6),
    });
  }
  return history;
}

const node1History = generateGpuHistory(78, 24, 280);
const node2History = generateGpuHistory(85, 80, 380);
const node3History = generateGpuHistory(0, 48, 0);

export const INITIAL_NODES: VllmNode[] = [
  {
    id: 'vllm-1',
    name: 'vLLM 节点 A',
    host: '192.168.1.101',
    port: 8000,
    status: 'running',
    model: 'meta-llama/Llama-3-8b-instruct',
    gpuLabel: '1× RTX 4090',
    gpuCount: 1,
    currentMetric: node1History[node1History.length - 1],
    history: node1History,
    requestsInFlight: 3,
    totalServed: 142_350,
    avgTtft: 42,
  },
  {
    id: 'vllm-2',
    name: 'vLLM 节点 B',
    host: '192.168.1.102',
    port: 8000,
    status: 'running',
    model: 'mistralai/Mistral-7B-v0.1',
    gpuLabel: '1× A100 80G',
    gpuCount: 1,
    currentMetric: node2History[node2History.length - 1],
    history: node2History,
    requestsInFlight: 7,
    totalServed: 287_120,
    avgTtft: 28,
  },
  {
    id: 'vllm-3',
    name: 'vLLM 节点 C',
    host: '192.168.1.103',
    port: 8000,
    status: 'stopped',
    model: 'Qwen/Qwen1.5-14B-Chat',
    gpuLabel: '2× RTX 3090',
    gpuCount: 2,
    currentMetric: node3History[node3History.length - 1],
    history: node3History,
    requestsInFlight: 0,
    totalServed: 54_860,
    avgTtft: 0,
  },
];

export const INITIAL_ROUTES: LiteLLMRoute[] = [
  {
    id: 'r-1',
    modelMatch: 'llama-3*',
    target: 'vLLM 节点 A',
    provider: 'vllm',
    status: 'active',
    rpmLimit: 300,
    currentRpm: 124,
    avgLatencyMs: 85,
    errorRate: 0.002,
  },
  {
    id: 'r-2',
    modelMatch: 'mistral*',
    target: 'vLLM 节点 B',
    provider: 'vllm',
    status: 'active',
    rpmLimit: 500,
    currentRpm: 231,
    avgLatencyMs: 62,
    errorRate: 0.001,
  },
  {
    id: 'r-3',
    modelMatch: 'qwen*',
    target: 'vLLM 节点 C',
    provider: 'vllm',
    status: 'down',
    rpmLimit: 200,
    currentRpm: 0,
    avgLatencyMs: 0,
    errorRate: 0,
  },
  {
    id: 'r-4',
    modelMatch: 'gpt-3.5-turbo*',
    target: 'api.openai.com',
    provider: 'openai',
    status: 'active',
    rpmLimit: 1000,
    currentRpm: 45,
    avgLatencyMs: 420,
    errorRate: 0.005,
  },
  {
    id: 'r-5',
    modelMatch: 'claude-3*',
    target: 'api.anthropic.com',
    provider: 'anthropic',
    status: 'active',
    rpmLimit: 200,
    currentRpm: 12,
    avgLatencyMs: 380,
    errorRate: 0,
  },
];

function buildReqHistory() {
  const history = [];
  const now = Date.now();
  let reqs = 80;
  let errs = 1;
  for (let i = 59; i >= 0; i--) {
    reqs = clamp(reqs + (Math.random() - 0.5) * 20, 20, 200);
    errs = clamp(errs + (Math.random() - 0.5) * 2, 0, 10);
    history.push({
      timestamp: now - i * 5000,
      requests: Math.round(reqs),
      errors: Math.round(errs),
    });
  }
  return history;
}

export const INITIAL_HEALTH: GatewayHealth = {
  uptime: 3600 * 24 * 3 + 7200,
  totalRequests: 1_248_340,
  errorRate: 0.003,
  queueDepth: 4,
  activeConnections: 12,
  reqRateHistory: buildReqHistory(),
};

// ─── Log templates ────────────────────────────────────────────────────────────

type LogTemplate = { level: LogLevel; source: LogSource; msg: () => string };

const REQUEST_IDS = ['a3f9b', 'c7d12', '8e4fa', 'b1c30', '92d7e', 'f50a1', '4b82c', 'd61e9'];
const MODELS = ['llama-3', 'mistral-7b', 'qwen-14b'];

export const LOG_TEMPLATES: LogTemplate[] = [
  { level: 'info',  source: 'litellm',     msg: () => `Received request ${pick(REQUEST_IDS)} for model ${pick(MODELS)}` },
  { level: 'info',  source: 'litellm',     msg: () => `Routing to ${pick(['vllm-node-1','vllm-node-2'])} via round-robin` },
  { level: 'info',  source: 'litellm',     msg: () => `Request ${pick(REQUEST_IDS)} completed in ${rand(30,250)}ms, ${rand(50,400)} tokens` },
  { level: 'info',  source: 'litellm',     msg: () => `Cache hit (prompt hash ${rand(1000,9999)}) — saved ${rand(10,150)} tokens` },
  { level: 'info',  source: 'litellm',     msg: () => `Cost recorded: $${(Math.random() * 0.001).toFixed(6)} for ${rand(100,500)} tokens` },
  { level: 'warn',  source: 'litellm',     msg: () => `Rate limit approaching: ${rand(280,299)}/300 rpm on key sk-***` },
  { level: 'warn',  source: 'litellm',     msg: () => `Retry attempt 1/3 for request ${pick(REQUEST_IDS)} (timeout)` },
  { level: 'error', source: 'litellm',     msg: () => `Request ${pick(REQUEST_IDS)} failed: upstream 503 from vllm-node-3` },
  { level: 'debug', source: 'litellm',     msg: () => `Load balancer selected node based on least-latency: ${rand(45,120)}ms` },
  { level: 'info',  source: 'vllm-node-1', msg: () => `Allocated ${rand(10,50)} KV cache blocks for seq ${rand(1000,9999)}` },
  { level: 'info',  source: 'vllm-node-1', msg: () => `Running ${rand(1,8)} seqs, ${rand(50,200)} free blocks, util ${rand(60,95)}%` },
  { level: 'info',  source: 'vllm-node-1', msg: () => `Generated ${rand(50,300)} tokens @ ${rand(100,140)} tok/s (PagedAttention)` },
  { level: 'debug', source: 'vllm-node-1', msg: () => `Prefill ${rand(20,120)} tokens in ${rand(5,30)}ms` },
  { level: 'info',  source: 'vllm-node-2', msg: () => `Request ${pick(REQUEST_IDS)} finished: ${rand(80,400)} tokens in ${rand(0.5,3).toFixed(2)}s` },
  { level: 'info',  source: 'vllm-node-2', msg: () => `GPU util ${rand(75,92)}%, VRAM ${rand(58,76)}GB/80GB` },
  { level: 'warn',  source: 'vllm-node-2', msg: () => `VRAM usage high: ${rand(70,78)}GB / 80GB — consider offloading` },
  { level: 'debug', source: 'vllm-node-2', msg: () => `Continuous batching: merged ${rand(2,6)} sequences` },
  { level: 'info',  source: 'system',      msg: () => `Health check passed — all endpoints reachable` },
  { level: 'info',  source: 'system',      msg: () => `Metrics snapshot: CPU ${rand(10,40)}%, MEM ${rand(8,24)}GB` },
  { level: 'warn',  source: 'system',      msg: () => `vllm-node-3 unreachable — removed from active pool` },
  { level: 'debug', source: 'system',      msg: () => `Prometheus scrape complete (${rand(50,120)} metrics)` },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min);
}

export function generateLogEntry(): LogEntry {
  const tpl = pick(LOG_TEMPLATES);
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date(),
    level: tpl.level,
    source: tpl.source,
    message: tpl.msg(),
  };
}

// ─── Playground response corpus ───────────────────────────────────────────────

export const RESPONSE_CORPUS: Record<string, string[]> = {
  'llama-3': [
    '您好！我是通过 LiteLLM 网关路由到 vLLM 节点 A（RTX 4090）上运行的 Llama-3 模型。得益于 vLLM 的 PagedAttention 技术，您看到的响应速度非常快。LiteLLM 统一了 API 格式，让您可以用同一套代码切换不同后端。',
    '基于 Llama-3-8B 架构，我能处理复杂的推理任务。当前节点通过 vLLM 的连续批处理技术同时处理多个请求，极大提升了 GPU 利用率。您可以在节点管理页面实时查看我的运行指标。',
    '这是 Llama-3 从 vLLM 后端生成的回复。每个 token 的生成延迟约 7ms，首 token 时间（TTFT）约 42ms。LiteLLM 自动记录了本次请求的 token 消耗和成本。',
  ],
  'mistral': [
    '您好！我是 Mistral-7B，运行在搭载 A100 80G 的 vLLM 节点 B 上。A100 的大显存使我能同时处理更多并发请求，当前吞吐量约 188 tokens/s。LiteLLM 根据您的模型名称自动将请求路由到这里。',
    '作为 Mistral 模型，我在代码生成和逻辑推理方面表现出色。vLLM 的 PagedAttention 让我能高效管理 KV Cache，避免了内存碎片。您可以在调试页面查看实时的容器日志。',
    '这是通过 LiteLLM 统一终点 /v1/chat/completions 转发给 Mistral-7B 的响应。整个架构对您完全透明——您发送标准 OpenAI 格式请求，系统自动完成路由、负载均衡和成本记录。',
  ],
};
