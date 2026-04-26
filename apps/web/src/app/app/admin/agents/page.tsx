'use client';

/**
 * Admin · Agents — registry + recent runs (M11.8).
 *
 * Top: per-agent summary card (key, default model, enabled, last run).
 * Below: paginated stream of agent_runs with status pill, latency,
 * cost, hitl status, and an expandable input/output diff.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

type AgentKey =
  | 'intake_orchestrator' | 'risk_screening' | 'anesthesia_clearance'
  | 'referral' | 'scheduling' | 'patient_comms' | 'pre_hab'
  | 'documentation' | 'task_tracker' | 'readiness';

interface AgentSummary {
  id: string;
  key: AgentKey;
  displayName: string;
  role: string;
  defaultModel: string;
  defaultTemperature: number;
  enabled: boolean;
}

interface AgentRun {
  id: string;
  createdAt: string;
  agentKey: AgentKey;
  triggerEvent: string;
  caseId: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  inputJson: unknown;
  outputJson: unknown;
  promptTokens: number | null;
  completionTokens: number | null;
  totalCostUsdMicros: number | null;
  latencyMs: number | null;
  hitlStatus: 'n_a' | 'pending' | 'approved' | 'declined';
  errorMessage: string | null;
}

const STATUS_FILTERS: Array<'all' | AgentRun['status']> = [
  'all', 'queued', 'running', 'succeeded', 'failed',
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
function fmtCost(micros: number | null): string {
  if (!micros) return '—';
  // micros = USD * 1e6
  const usd = micros / 1e6;
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}
function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function AdminAgentsPage() {
  const [registry, setRegistry] = useState<AgentSummary[] | null>(null);
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | AgentRun['status']>('all');
  const [agentKey, setAgentKey] = useState<'all' | AgentKey>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [r, runsRes] = await Promise.all([
        jsonOrThrow<{ items: AgentSummary[] }>(await fetch('/api/admin/agents')),
        jsonOrThrow<{ items: AgentRun[] }>(
          await fetch(
            `/api/admin/agents/runs?limit=200${agentKey !== 'all' ? `&agentKey=${agentKey}` : ''}${status !== 'all' ? `&status=${status}` : ''}`,
          ),
        ),
      ]);
      setRegistry(r.items);
      setRuns(runsRes.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [agentKey, status]);

  const stats = useMemo(() => {
    if (!runs) return null;
    return {
      total: runs.length,
      succeeded: runs.filter((r) => r.status === 'succeeded').length,
      failed: runs.filter((r) => r.status === 'failed').length,
      pending: runs.filter((r) => r.hitlStatus === 'pending').length,
      totalCost: runs.reduce((a, r) => a + (r.totalCostUsdMicros ?? 0), 0),
    };
  }, [runs]);

  return (
    <AppShell breadcrumbs={['Admin', 'Agents']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Agents</span>
          <h1>AI orchestration <span className="emph">control plane</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {/* Registry */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>Registered agents</h3></div>
        {!registry ? (
          <div className="muted">Loading…</div>
        ) : registry.length === 0 ? (
          <div className="muted">
            No agents in the registry yet. Run the seed script after migration 0007:
            <pre style={{ fontSize: 12, marginTop: 8 }}>
              pnpm --filter @primedhealth/api seed:agents
            </pre>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Name</th>
                <th>Role</th>
                <th>Model</th>
                <th>Temp</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {registry.map((a) => (
                <tr key={a.id}>
                  <td><code>{a.key}</code></td>
                  <td>{a.displayName}</td>
                  <td className="muted">{a.role}</td>
                  <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {a.defaultModel}
                  </td>
                  <td>{a.defaultTemperature.toFixed(2)}</td>
                  <td>
                    <span className={`status-pill ${a.enabled ? 'completed' : 'cancelled'}`}>
                      {a.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi"><div className="lbl">Runs</div><div className="val">{stats.total}</div></div>
          <div className="kpi"><div className="lbl">Succeeded</div><div className="val">{stats.succeeded}</div></div>
          <div className="kpi"><div className="lbl">Failed</div><div className="val">{stats.failed}</div></div>
          <div className="kpi"><div className="lbl">Pending HITL</div><div className="val">{stats.pending}</div></div>
          <div className="kpi"><div className="lbl">Total cost</div><div className="val">{fmtCost(stats.totalCost)}</div></div>
        </div>
      )}

      {/* Runs */}
      <div className="toolbar">
        <div className="seg">
          {STATUS_FILTERS.map((s) => (
            <button key={s} type="button" className={status === s ? 'active' : undefined} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        <select className="input" value={agentKey} onChange={(e) => setAgentKey(e.target.value as typeof agentKey)} style={{ width: 220 }}>
          <option value="all">all agents</option>
          {(registry ?? []).map((a) => (
            <option key={a.key} value={a.key}>{a.displayName}</option>
          ))}
        </select>
        <div className="spacer" />
        <span className="status-pill neutral">{runs?.length ?? 0} runs</span>
      </div>

      {!runs ? (
        <div className="muted">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="card"><div className="muted">No agent runs yet. Open a case to trigger IntakeOrchestrator.</div></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Agent</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>HITL</th>
              <th>Latency</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Case</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const open = expanded === r.id;
              return (
                <>
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(open ? null : r.id)}>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td><code>{r.agentKey}</code></td>
                    <td className="muted">{r.triggerEvent}</td>
                    <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
                    <td>
                      {r.hitlStatus === 'n_a'
                        ? <span className="muted">—</span>
                        : <span className={`status-pill ${r.hitlStatus}`}>{r.hitlStatus}</span>}
                    </td>
                    <td className="muted">{fmtMs(r.latencyMs)}</td>
                    <td className="muted">
                      {r.promptTokens != null && r.completionTokens != null
                        ? `${r.promptTokens} → ${r.completionTokens}`
                        : '—'}
                    </td>
                    <td className="muted">{fmtCost(r.totalCostUsdMicros)}</td>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {r.caseId ? r.caseId.slice(0, 8) : '—'}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{open ? '▼' : '▶'}</td>
                  </tr>
                  {open && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={10} style={{ background: 'var(--surface-50, #fafafa)', padding: 16 }}>
                        {r.errorMessage && (
                          <div style={{ color: 'var(--danger, #c0392b)', marginBottom: 12, fontSize: 12 }}>
                            {r.errorMessage}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                          <div>
                            <div className="muted" style={{ marginBottom: 4 }}>input</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {r.inputJson ? JSON.stringify(r.inputJson, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div className="muted" style={{ marginBottom: 4 }}>output</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {r.outputJson ? JSON.stringify(r.outputJson, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
