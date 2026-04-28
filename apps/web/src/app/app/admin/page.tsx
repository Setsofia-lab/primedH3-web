'use client';

/**
 * Admin · Dashboard — original Phase 1 visual + live data.
 *
 *   page-head                  greeting + Export report / Invite user
 *   kpi-grid (4 tiles)         Active cases · Avg readiness · Same-day
 *                              cancels · Agent runs · 24h
 *   dash-grid (2 cols)         Live agent activity (LIVE pill, 5s
 *                              poll) + Agent health (6 agent rows)
 *
 * All stats derived from real data:
 *   Active cases       = /api/admin/cases ! cancelled/completed
 *   Avg readiness      = avg(readinessScore) over scored active cases
 *   Same-day cancels   = cancelled cases whose surgeryDate is today
 *   Agent runs · 24h   = /api/admin/agents/runs since createdAt-24h
 *   Live activity      = /api/admin/agents/runs?limit=8 polled every 5s
 *   Agent health       = /api/admin/agents (registry) + p50 from runs
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { useCurrentUser } from '@/lib/auth/use-current-user';

interface CaseRow {
  id: string;
  status: string;
  readinessScore: number | null;
  surgeryDate: string | null;
}
interface Agent {
  id: string;
  key: string;
  displayName: string;
  defaultModel: string;
  defaultTemperature: number;
  enabled: boolean;
}
interface Run {
  id: string;
  agentKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  triggerEvent: string;
  caseId: string | null;
  outputJson: unknown;
  latencyMs: number | null;
  createdAt: string;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

function summarizeRun(r: Run): string {
  const o = r.outputJson;
  if (o && typeof o === 'object') {
    const obj = o as Record<string, unknown>;
    const summary = obj.summary ?? obj.narrative ?? obj.draftReply;
    if (typeof summary === 'string' && summary.length > 0) {
      return summary.length > 90 ? `${summary.slice(0, 90)}…` : summary;
    }
  }
  return r.triggerEvent;
}

const HIGHLIGHT_NAMES = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
function formatMsg(msg: string): React.ReactNode[] {
  const parts = msg.split(HIGHLIGHT_NAMES);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

function p50(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export default function AdminDashboardPage() {
  const me = useCurrentUser();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [, setTick] = useState(0);

  async function load() {
    const [c, a, r] = await Promise.all([
      jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/admin/cases?limit=200')),
      jsonOrNull<{ items: Agent[] }>(await fetch('/api/admin/agents')),
      jsonOrNull<{ items: Run[] }>(await fetch('/api/admin/agents/runs?limit=200')),
    ]);
    setCases(c?.items ?? []);
    setAgents(a?.items ?? []);
    setRuns(r?.items ?? []);
  }

  useEffect(() => { void load(); }, []);

  // Poll the activity stream + counts every 5s; tick the timestamps every 10s.
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 5_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const kpis = useMemo(() => {
    const list = cases ?? [];
    const active = list.filter((c) => c.status !== 'cancelled' && c.status !== 'completed');
    const scored = active.filter((c) => c.readinessScore != null);
    const avg = scored.length === 0
      ? null
      : Math.round(scored.reduce((s, c) => s + (c.readinessScore ?? 0), 0) / scored.length);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const cancelsToday = list.filter((c) =>
      c.status === 'cancelled' && c.surgeryDate
        && new Date(c.surgeryDate) >= today && new Date(c.surgeryDate) < tomorrow,
    ).length;

    const last24h = Date.now() - 24 * 3600 * 1000;
    const runs24 = (runs ?? []).filter((r) => new Date(r.createdAt).getTime() >= last24h);
    const failures = runs24.filter((r) => r.status === 'failed').length;

    return {
      activeCases: active.length,
      activeWeekDelta: active.filter((c) => {
        const t = c.surgeryDate ? new Date(c.surgeryDate).getTime() : 0;
        return t > Date.now() - 7 * 24 * 3600 * 1000;
      }).length,
      avgReadiness: avg,
      cancelsToday,
      runs24h: runs24.length,
      failures24h: failures,
    };
  }, [cases, runs]);

  const recentRuns = useMemo(() => (runs ?? []).slice(0, 8), [runs]);

  const healthRows = useMemo(() => {
    if (!agents) return [];
    const last24h = Date.now() - 24 * 3600 * 1000;
    return agents.slice(0, 6).map((a) => {
      const aRuns = (runs ?? []).filter(
        (r) => r.agentKey === a.key && new Date(r.createdAt).getTime() >= last24h,
      );
      const lats = aRuns.map((r) => r.latencyMs ?? 0).filter((x) => x > 0);
      const failed = aRuns.filter((r) => r.status === 'failed').length;
      const status = !a.enabled
        ? 'cancelled'
        : failed > 0
          ? 'deferred'
          : 'completed';
      return {
        id: a.id,
        name: a.displayName,
        model: a.defaultModel.replace(/^us\.anthropic\./, '').replace(/-\d{8}-v\d:0$/, ''),
        runs24h: aRuns.length,
        p50: (p50(lats) / 1000).toFixed(1),
        status: status as 'completed' | 'deferred' | 'cancelled',
      };
    });
  }, [agents, runs]);

  const greeting = (() => {
    const last = me?.lastName ?? '';
    return last ? `Good morning, Dr. ${last}` : 'Good morning';
  })();

  return (
    <AppShell breadcrumbs={['Admin', 'Dashboard']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · PrimedHealth Demo Hospital</span>
          <h1>
            {greeting && (
              <>
                Good morning, Dr. <span className="emph">{me?.lastName ?? ''}</span>.
              </>
            )}
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" disabled>Export report</button>
          <Link className="btn btn-primary" href="/app/admin/users">Invite user</Link>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi blue">
          <div className="lbl">Active cases</div>
          <div className="val">{kpis.activeCases}</div>
          <div className="delta">+{kpis.activeWeekDelta} this week</div>
        </div>
        <div className="kpi">
          <div className="lbl">Avg readiness</div>
          <div className="val">
            {kpis.avgReadiness ?? '—'}
            {kpis.avgReadiness != null && (
              <span style={{ fontSize: '1.25rem', color: 'var(--ink-500)' }}>%</span>
            )}
          </div>
          <div className="delta">across scored cases</div>
        </div>
        <div className="kpi">
          <div className="lbl">Same-day cancels</div>
          <div className="val">{kpis.cancelsToday}</div>
          <div className="delta">today</div>
        </div>
        <div className="kpi">
          <div className="lbl">Agent runs · 24h</div>
          <div className="val">{kpis.runs24h.toLocaleString()}</div>
          <div className={`delta${kpis.failures24h > 0 ? ' down' : ''}`}>
            {kpis.failures24h} failures
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <h3>Live agent activity</h3>
            <span className="live">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
          <div className="stream">
            {recentRuns.length === 0 ? (
              <div className="muted" style={{ padding: '0.625rem 0', fontSize: '0.875rem' }}>
                No agent runs yet. Open or update a case to fan out the
                IntakeOrchestrator + RiskScreening + ReadinessAgent.
              </div>
            ) : recentRuns.map((r) => (
              <div className="ev" key={r.id}>
                <span className="agent-tag">{r.agentKey}</span>
                <div className="msg">{formatMsg(summarizeRun(r))}</div>
                <span className="time">{timeAgo(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Agent health</h3>
            <Link href="/app/admin/agents" className="view-all">All agents →</Link>
          </div>
          <div className="agents-health">
            {healthRows.length === 0 ? (
              <div className="muted" style={{ padding: '0.625rem 0', fontSize: '0.875rem' }}>
                No agents registered yet.
              </div>
            ) : healthRows.map((a) => (
              <div className="ah-row" key={a.id}>
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="sub">
                    {a.model} · {a.runs24h} runs
                  </div>
                </div>
                <span className="runs">p50 {a.p50}s</span>
                <span className={`status-pill ${a.status}`}>
                  {a.status === 'completed' ? 'healthy' : a.status === 'deferred' ? 'degraded' : 'disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
