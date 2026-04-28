'use client';

/**
 * AgentActivityCard — real-time view of agent_runs.
 *
 * Two modes:
 *   source="admin"        → polls /api/admin/agents/runs (admin-only)
 *   source="case", caseId → polls /api/cases/[id]/agent-runs
 *
 * Polls every 8s while the tab is visible. Each row shows the agent
 * key, status, HITL state, latency, cost (USD micros → $X.XX), and
 * the model output text (when available). The list auto-prepends new
 * runs without a full re-fetch jitter.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Run {
  id: string;
  agentKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  hitlStatus: 'n_a' | 'pending' | 'approved' | 'declined';
  triggerEvent: string;
  caseId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalCostUsdMicros: number | null;
  latencyMs: number | null;
  outputJson: unknown;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Props {
  source: 'admin' | 'case';
  caseId?: string;
  /** How many rows to show (default 12). */
  limit?: number;
  /** Card heading (default "Agent activity"). */
  title?: string;
  /** When true, status pills + token counts are dimmed; useful for embed. */
  compact?: boolean;
}

const POLL_MS = 8_000;

const STATUS_COLOR: Record<Run['status'], { bg: string; fg: string }> = {
  queued: { bg: '#eef2fe', fg: '#3b55d9' },
  running: { bg: '#fff7e6', fg: '#a96400' },
  succeeded: { bg: '#e8f6ec', fg: '#0f7838' },
  failed: { bg: '#fde8e8', fg: '#a61b1b' },
};

const HITL_LABEL: Record<Run['hitlStatus'], string> = {
  n_a: '',
  pending: 'pending review',
  approved: 'approved',
  declined: 'declined',
};

function fmtCost(micros: number | null): string {
  if (!micros || micros <= 0) return '—';
  const usd = micros / 1e6;
  return usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`;
}

function fmtLatency(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function summarizeOutput(o: unknown): string {
  if (!o || typeof o !== 'object') return '';
  const obj = o as Record<string, unknown>;
  // Most agents emit a `summary` field; fall back to `narrative` (Readiness)
  // or first useful string property.
  const summary = obj.summary ?? obj.narrative ?? obj.draftReply ?? obj.patientSummary;
  if (typeof summary === 'string' && summary.length > 0) {
    return summary.length > 200 ? `${summary.slice(0, 200)}…` : summary;
  }
  return '';
}

const AGENT_LABEL: Record<string, string> = {
  intake_orchestrator: 'IntakeOrchestrator',
  risk_screening: 'RiskScreening',
  anesthesia_clearance: 'AnesthesiaClearance',
  scheduling: 'Scheduling',
  referral: 'Referral',
  patient_comms: 'PatientComms',
  pre_hab: 'PreHab',
  documentation: 'Documentation',
  task_tracker: 'TaskTracker',
  readiness: 'Readiness',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export function AgentActivityCard({
  source,
  caseId,
  limit = 12,
  title = 'Agent activity',
  compact = false,
}: Props) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const url = useMemo(() => {
    if (source === 'admin') return `/api/admin/agents/runs?limit=${limit}`;
    if (!caseId) return null;
    return `/api/cases/${encodeURIComponent(caseId)}/agent-runs?limit=${limit}`;
  }, [source, caseId, limit]);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function tick() {
      if (inflight.current) return;
      inflight.current = true;
      try {
        const data = await fetchJson<{ items: Run[] }>(url!);
        if (alive) {
          setRuns(data.items);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        inflight.current = false;
      }
    }
    void tick();
    timer = setInterval(tick, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url]);

  const empty = runs?.length === 0;

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 11, color: 'var(--ink-400, #6B7895)' }}>
          {runs == null ? 'Loading…' : `${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`}
        </span>
      </div>

      {error && (
        <div style={{ color: '#a61b1b', fontSize: 12, marginBottom: 8 }}>
          Couldn't load runs: {error}
        </div>
      )}

      {empty && (
        <div style={{ color: 'var(--ink-400, #6B7895)', fontSize: 13 }}>
          No agent runs yet. {source === 'case'
            ? 'Trigger one from the workup panel above (e.g. Re-run risk screen).'
            : 'Create or update a case to fan agents out.'}
        </div>
      )}

      {runs && runs.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {runs.map((r) => {
            const sc = STATUS_COLOR[r.status];
            const hitlText = HITL_LABEL[r.hitlStatus];
            const summary = summarizeOutput(r.outputJson);
            return (
              <li key={r.id} style={{ borderTop: '1px solid var(--border, #E4E8F5)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>
                    {AGENT_LABEL[r.agentKey] ?? r.agentKey}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      background: sc.bg,
                      color: sc.fg,
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontWeight: 500,
                    }}
                  >
                    {r.status}
                  </span>
                  {hitlText && (
                    <span
                      style={{
                        fontSize: 11,
                        background:
                          r.hitlStatus === 'pending'
                            ? '#fff7e6'
                            : r.hitlStatus === 'approved'
                              ? '#e8f6ec'
                              : '#fde8e8',
                        color:
                          r.hitlStatus === 'pending'
                            ? '#a96400'
                            : r.hitlStatus === 'approved'
                              ? '#0f7838'
                              : '#a61b1b',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      {hitlText}
                    </span>
                  )}
                  {!compact && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-400, #6B7895)' }}>
                      {fmtLatency(r.latencyMs)} · {fmtCost(r.totalCostUsdMicros)}
                    </span>
                  )}
                </div>
                {summary && (
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-700, #1F2A44)', lineHeight: 1.4 }}>
                    {summary}
                  </div>
                )}
                {r.errorMessage && r.status === 'failed' && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#a61b1b' }}>
                    {r.errorMessage.slice(0, 240)}
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-400, #6B7895)' }}>
                  {r.triggerEvent} · {new Date(r.createdAt).toLocaleString()}
                  {source === 'admin' && r.caseId && (
                    <>
                      {' · '}
                      <Link
                        href={`/app/admin/cases/${r.caseId}`}
                        style={{ color: 'var(--primary-blue, #4B6BEF)' }}
                      >
                        case
                      </Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
