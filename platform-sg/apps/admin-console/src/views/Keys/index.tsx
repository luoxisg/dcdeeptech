/**
 * API Key Management view — DCDeepTech control plane.
 *
 * Connects to the Python backend at /admin/api-keys when VITE_GATEWAY_URL is set.
 * Falls back to demo/mock data when the backend is not reachable (local dev).
 *
 * Security notes enforced in this UI:
 *   - Full key is shown ONCE in a modal immediately after creation
 *   - After dismissal, only the prefix is ever displayed
 *   - Key values are never written to console.log or component state beyond
 *     the one-time reveal modal
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Copy, KeyRound,
  Plus, RefreshCw, ShieldOff, Trash2, XCircle,
} from 'lucide-react';
import type { ApiKeyRecord, ApiKeyScope, ApiKeyStatus, CreateKeyResponse } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? '';

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'chat:completions':  'Chat',
  'embeddings':        'Embeddings',
  'admin:keys':        'Admin: Keys',
  'admin:tenants':     'Admin: Tenants',
  'internal:routing':  'Internal: Routing',
};

const STATUS_CFG: Record<ApiKeyStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  active:   { label: '有效',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle2 size={12} /> },
  disabled: { label: '已停用', cls: 'text-amber-400   bg-amber-500/10   border-amber-500/30',   icon: <AlertTriangle size={12} /> },
  revoked:  { label: '已吊销', cls: 'text-red-400     bg-red-500/10     border-red-500/30',     icon: <XCircle size={12} /> },
  expired:  { label: '已过期', cls: 'text-gray-400    bg-gray-500/10    border-gray-500/30',    icon: <ShieldOff size={12} /> },
};

// ─── Mock data (used when backend is unreachable) ─────────────────────────────

const MOCK_KEYS: ApiKeyRecord[] = [
  {
    key_id:       'kdcdt_BootstrapA',
    key_prefix:   'sk-dcdt-AdminKe...',
    tenant_id:    'dcdt-admin',
    description:  'Bootstrap admin key',
    scopes:       ['admin:keys', 'admin:tenants', 'chat:completions', 'internal:routing'],
    status:       'active',
    created_at:   new Date(Date.now() - 86400_000 * 3).toISOString(),
    expires_at:   null,
    last_used_at: new Date(Date.now() - 300_000).toISOString(),
  },
  {
    key_id:       'kdcdt_Tenant001',
    key_prefix:   'sk-dcdt-TenantA...',
    tenant_id:    'tenant-acme',
    description:  'ACME Corp integration key',
    scopes:       ['chat:completions'],
    status:       'active',
    created_at:   new Date(Date.now() - 86400_000).toISOString(),
    expires_at:   new Date(Date.now() + 86400_000 * 90).toISOString(),
    last_used_at: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    key_id:       'kdcdt_Tenant002',
    key_prefix:   'sk-dcdt-OldTest...',
    tenant_id:    'tenant-test',
    description:  'Old test key — revoked',
    scopes:       ['chat:completions'],
    status:       'revoked',
    created_at:   new Date(Date.now() - 86400_000 * 10).toISOString(),
    expires_at:   null,
    last_used_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  if (!GATEWAY_URL) throw new Error('VITE_GATEWAY_URL not set');
  return fetch(`${GATEWAY_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
}

// ─── One-time key reveal modal ────────────────────────────────────────────────

function KeyRevealModal({
  result,
  onClose,
}: {
  result: CreateKeyResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(result.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.key]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-amber-500/60 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={22} className="text-amber-400 shrink-0" />
          <h3 className="text-lg font-bold text-amber-300">保存您的 API Key</h3>
        </div>

        <p className="text-sm text-gray-300 mb-4 leading-relaxed">
          您的 API Key 仅在此时显示<strong className="text-white">一次</strong>。
          关闭此窗口后将无法再次查看完整 Key。请立即复制并存入密钥管理工具。
        </p>

        <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 font-mono text-sm text-emerald-300 break-all mb-4 select-all">
          {result.key}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-6">
          <div><span className="text-gray-500">Key ID:</span> {result.key_id}</div>
          <div><span className="text-gray-500">Tenant:</span> {result.tenant_id}</div>
          <div className="col-span-2">
            <span className="text-gray-500">Scopes:</span>{' '}
            {result.scopes.join(', ')}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Copy size={15} />
            {copied ? '已复制！' : '复制 Key'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            已保存，关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create key form ──────────────────────────────────────────────────────────

function CreateKeyPanel({ onCreated }: { onCreated: (r: CreateKeyResponse) => void }) {
  const [tenantId, setTenantId]   = useState('');
  const [description, setDesc]    = useState('');
  const [scopes, setScopes]       = useState<Set<ApiKeyScope>>(new Set(['chat:completions']));
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const toggleScope = (s: ApiKeyScope) => {
    setScopes((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!tenantId.trim()) { setError('请填写 Tenant ID'); return; }
    setError('');
    setLoading(true);

    try {
      if (!GATEWAY_URL) {
        // Demo mode: generate a fake key locally
        const fakeKey = `sk-dcdt-${btoa(Math.random().toString()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;
        onCreated({
          key_id: `kdcdt_${Math.random().toString(36).slice(2, 10)}`,
          key: fakeKey,
          key_prefix: fakeKey.slice(0, 16) + '...',
          tenant_id: tenantId,
          scopes: [...scopes],
          created_at: new Date().toISOString(),
          expires_at: null,
          message: 'Demo mode — not persisted',
        });
        return;
      }

      const res = await apiFetch('/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, description, scopes: [...scopes] }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setLoading(false);
      setTenantId('');
      setDesc('');
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
        <Plus size={16} className="text-blue-400" /> 创建新 API Key
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Tenant ID *</label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="例如: tenant-acme"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">描述（可选）</label>
          <input
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="例如: ACME Corp 集成 Key"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-2 block">权限范围 (Scopes)</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(SCOPE_LABELS) as [ApiKeyScope, string][]).map(([scope, label]) => (
            <button
              key={scope}
              onClick={() => toggleScope(scope)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                scopes.has(scope)
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                  : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {loading ? '创建中…' : '创建 API Key'}
      </button>

      {!GATEWAY_URL && (
        <p className="text-xs text-amber-400/70 text-center">
          ⚠ 演示模式 — 未连接后端，Key 不会持久化。设置 VITE_GATEWAY_URL 以连接真实网关。
        </p>
      )}
    </div>
  );
}

// ─── Key table row ────────────────────────────────────────────────────────────

const KeyRow = React.memo(function KeyRow({
  record,
  onAction,
}: {
  record: ApiKeyRecord;
  onAction: (action: 'disable' | 'revoke', keyId: string) => void;
}) {
  const { label, cls, icon } = STATUS_CFG[record.status];
  const canAct = record.status === 'active' || record.status === 'disabled';

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('zh-CN') : '—';

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-800/40 transition-colors">
      <td className="px-4 py-3">
        <p className="font-mono text-xs text-blue-300">{record.key_prefix}</p>
        <p className="text-xs text-gray-500 mt-0.5">{record.key_id}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">{record.tenant_id}</td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-200 truncate max-w-[160px]">{record.description || '—'}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {record.scopes.map((s) => (
            <span key={s} className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {SCOPE_LABELS[s as ApiKeyScope] ?? s}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-1 rounded-full border flex items-center w-fit gap-1 ${cls}`}>
          {icon} {label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        <div>{fmt(record.created_at)}</div>
        {record.last_used_at && (
          <div className="text-gray-500">最后使用: {fmt(record.last_used_at)}</div>
        )}
        {record.expires_at && (
          <div className="text-amber-500/70">到期: {fmt(record.expires_at)}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {canAct && (
          <div className="flex gap-1">
            <button
              onClick={() => onAction('disable', record.key_id)}
              title="停用"
              className="p-1.5 hover:bg-amber-900/30 rounded text-gray-400 hover:text-amber-400 transition-colors"
            >
              <AlertTriangle size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`确认吊销 Key ${record.key_id}？此操作不可撤销。`))
                  onAction('revoke', record.key_id);
              }}
              title="吊销"
              className="p-1.5 hover:bg-red-900/30 rounded text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});

// ─── View root ────────────────────────────────────────────────────────────────

export function Keys() {
  const [keys, setKeys]       = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey]   = useState<CreateKeyResponse | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      if (!GATEWAY_URL) {
        setKeys(MOCK_KEYS);
        return;
      }
      const res = await apiFetch('/admin/api-keys');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      setKeys(MOCK_KEYS); // Fallback to mock on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const handleAction = useCallback(
    async (action: 'disable' | 'revoke', keyId: string) => {
      try {
        if (GATEWAY_URL) {
          await apiFetch(`/admin/api-keys/${keyId}/${action}`, { method: 'POST' });
        }
        setKeys((prev) =>
          prev.map((k) =>
            k.key_id === keyId ? { ...k, status: action === 'revoke' ? 'revoked' : 'disabled' } : k,
          ),
        );
      } catch {
        alert('操作失败，请重试');
      }
    },
    [],
  );

  const handleCreated = useCallback((result: CreateKeyResponse) => {
    setNewKey(result);
    // Add the new key to the list (with prefix only — full key is in modal)
    setKeys((prev) => [
      {
        key_id:       result.key_id,
        key_prefix:   result.key_prefix,
        tenant_id:    result.tenant_id,
        description:  '',
        scopes:       result.scopes as ApiKeyScope[],
        status:       'active',
        created_at:   result.created_at,
        expires_at:   result.expires_at,
        last_used_at: null,
      },
      ...prev,
    ]);
  }, []);

  return (
    <div className="max-w-6xl space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <KeyRound size={20} className="text-blue-400" />
            DCDeepTech API Key 管理
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            管理对外发放的独立 API Key。客户持有 DCDeepTech Key，从不接触上游供应商 Key。
          </p>
        </div>
        <button
          onClick={loadKeys}
          disabled={loading}
          className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
          title="刷新"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Create panel */}
      <CreateKeyPanel onCreated={handleCreated} />

      {/* Key table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-900/60 border-b border-gray-700">
            <tr>
              {['Key 标识', '租户', '描述', '权限范围', '状态', '时间信息', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">
                  <RefreshCw size={16} className="inline animate-spin mr-2" />
                  加载中…
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">
                  暂无 API Key，点击上方"创建"按钮生成第一个 Key
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <KeyRow key={k.key_id} record={k} onAction={handleAction} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Security notice */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="flex items-center gap-1.5 text-gray-400 font-medium">
          <AlertTriangle size={13} className="text-amber-400" /> 安全说明
        </p>
        <p>• 完整 Key 仅在创建时显示一次，不在服务端持久化明文。</p>
        <p>• 服务端存储：Key ID、前缀、PBKDF2 哈希值（OWASP 260,000 次迭代）。</p>
        <p>• 审计日志只记录 key_id 和前缀，不记录完整 Key。</p>
        <p>• /admin/api-keys 接口应限制为内网访问（见 ADMIN_ALLOWED_CIDRS）。</p>
      </div>

      {/* One-time key reveal modal */}
      {newKey && (
        <KeyRevealModal result={newKey} onClose={() => setNewKey(null)} />
      )}
    </div>
  );
}
