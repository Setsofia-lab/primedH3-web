'use client';

/**
 * Coordinator · Board — original M8 visual restored, fed by live data.
 *
 * Reads /api/cases (server-scoped to the coordinator's facility),
 * /api/patients for chart info, /api/users for surgeons, and
 * /api/cases/:id/agent-runs for AI-drafted activity. Cards link to
 * the admin case detail (the coordinator's drill-in surface).
 *
 * Columns:
 *   intake     ← status = 'referral'
 *   clearance  ← status = 'workup' | 'clearance'
 *   sched      ← status = 'clearance' AND no surgery_date yet
 *   preop      ← status = 'pre_hab' | 'ready'
 *   surgery    ← status = 'completed'
 *
 * "Stuck" = >48h since updated_at AND not completed/cancelled.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { useCurrentUser } from '@/lib/auth/use-current-user';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

interface CaseRow {
  id: string;
  patientId: string;
  surgeonId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  readinessScore: number | null;
  surgeryDate: string | null;
  updatedAt: string;
  createdAt: string;
}
interface Patient { id: string; firstName: string; lastName: string; dob: string | null }
interface Provider { id: string; firstName: string; lastName: string; role: string }
interface Run { id: string; agentKey: string; status: string; hitlStatus: string }

type ColKey = 'intake' | 'clearance' | 'sched' | 'preop' | 'surgery';
const COLUMNS: Array<{ col: ColKey; title: string }> = [
  { col: 'intake', title: 'Intake' },
  { col: 'clearance', title: 'Clearance' },
  { col: 'sched', title: 'Scheduling' },
  { col: 'preop', title: 'Pre-op' },
  { col: 'surgery', title: 'Surgery' },
];

const STEPS_FOR: Record<ColKey, number> = {
  intake: 1, clearance: 2, sched: 3, preop: 4, surgery: 5,
};

const AI_TAG: Record<string, string> = {
  intake_orchestrator: 'Intake parsed',
  risk_screening: 'Risk drafted',
  anesthesia_clearance: 'Anesthesia draft',
  scheduling: 'Slots proposed',
  referral: 'Referral drafted',
  patient_comms: 'Reply drafted',
  pre_hab: 'Pre-hab drafted',
  documentation: 'H&P drafted',
  task_tracker: 'Tasks reorganised',
  readiness: 'Readiness recomputed',
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}
function hoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
}
function relativeAge(c: CaseRow): string {
  const h = hoursSince(c.updatedAt);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h since update`;
  return `${Math.floor(h / 24)}d since update`;
}
function colFor(c: CaseRow): ColKey | null {
  if (c.status === 'cancelled') return null;
  if (c.status === 'referral') return 'intake';
  if (c.status === 'workup') return 'clearance';
  if (c.status === 'clearance') return c.surgeryDate ? 'preop' : 'sched';
  if (c.status === 'pre_hab' || c.status === 'ready') return 'preop';
  if (c.status === 'completed') return 'surgery';
  return null;
}
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day + 6) % 7;
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

export default function CoordinatorBoardPage() {
  const me = useCurrentUser();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [surgeons, setSurgeons] = useState<Map<string, Provider>>(new Map());
  const [runsByCase, setRunsByCase] = useState<Map<string, Run[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
      ]);
      setCases(c.items);
      setPatients(new Map(p.items.map((x) => [x.id, x])));

      // Surgeons (users with role=surgeon, facility-scoped)
      try {
        const u = await jsonOrThrow<{ items: Provider[] }>(
          await fetch('/api/users?role=surgeon&limit=200'),
        );
        setSurgeons(new Map(u.items.map((x) => [x.id, x])));
      } catch {
        // 403 if endpoint not exposed for this role — non-blocking
      }

      // Lazy-fetch agent runs per case (capped to keep network sane)
      const ids = c.items.slice(0, 30).map((x) => x.id);
      const runs = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await jsonOrThrow<{ items: Run[] }>(
              await fetch(`/api/cases/${id}/agent-runs?limit=5`),
            );
            return [id, r.items] as const;
          } catch {
            return [id, [] as Run[]] as const;
          }
        }),
      );
      setRunsByCase(new Map(runs));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    if (!cases) return null;
    const out: Record<ColKey, CaseRow[]> = {
      intake: [], clearance: [], sched: [], preop: [], surgery: [],
    };
    for (const c of cases) {
      const col = colFor(c);
      if (col) out[col].push(c);
    }
    for (const k of Object.keys(out) as ColKey[]) {
      out[k].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return out;
  }, [cases]);

  const stuck = useMemo(() => {
    if (!cases) return [];
    return cases
      .filter((c) => c.status !== 'completed' && c.status !== 'cancelled' && hoursSince(c.updatedAt) >= 48)
      .sort((a, b) => hoursSince(b.updatedAt) - hoursSince(a.updatedAt))
      .slice(0, 3);
  }, [cases]);

  const kpiActive = (cases ?? []).filter((c) => c.status !== 'completed' && c.status !== 'cancelled').length;
  const kpiStuck = stuck.length;
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
  const kpiSurgeriesThisWeek = (cases ?? []).filter((c) => {
    if (!c.surgeryDate) return false;
    const t = new Date(c.surgeryDate).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  }).length;
  const kpiAiPending = [...runsByCase.values()].flat().filter((r) => r.hitlStatus === 'pending').length;

  const week = useMemo(() => {
    const out: Array<{ day: string; count: number }> = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart.getTime() + i * 24 * 3600 * 1000);
      const tomorrow = new Date(d.getTime() + 24 * 3600 * 1000);
      const count = (cases ?? []).filter((c) => {
        if (!c.surgeryDate) return false;
        const t = new Date(c.surgeryDate).getTime();
        return t >= d.getTime() && t < tomorrow.getTime();
      }).length;
      out.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        count,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases]);

  const meName = me ? `${me.firstName} ${me.lastName}` : 'Coordinator';

  return (
    <AppShell breadcrumbs={['Coordinator', 'Board']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · {meName}</span>
          <h1>Cases in <span className="emph"><em>flight</em></span>.</h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline-dark" href="/app/coordinator/tasks">Tasks</Link>
          <Link className="btn btn-primary" href="/app/coordinator/messages">Messages</Link>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '8px 0' }}>{error}</div>}

      <div className="kpi-mini">
        <div className="k"><div className="l">Cases active</div><div className="v">{kpiActive}</div></div>
        <div className="k"><div className="l">Stuck &gt; 48h</div><div className="v">{kpiStuck}</div></div>
        <div className="k"><div className="l">Surgeries this week</div><div className="v">{kpiSurgeriesThisWeek}</div></div>
        <div className="k"><div className="l">AI drafts pending</div><div className="v">{kpiAiPending}</div></div>
      </div>

      <div className="focus-grid">
        <div className="focus-card">
          <span className="eyebrow">TODAY&apos;S FOCUS · AI-TRIAGED</span>
          {stuck.length === 0 ? (
            <h2>No cases stuck &gt; 48h. <em>Nice work.</em></h2>
          ) : (
            <h2>
              {stuck.length === 1 ? 'One case is' : `${stuck.length} cases are`}{' '}
              <em>stuck</em>. Your attention unblocks them.
            </h2>
          )}
          <div className="ul">
            {stuck.map((c) => {
              const p = patients.get(c.patientId);
              const fullName = p ? `${p.firstName} ${p.lastName}` : 'Unknown';
              const ageHours = hoursSince(c.updatedAt);
              return (
                <Link
                  key={c.id}
                  className="itm"
                  href={`/app/coordinator/cases/${c.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <span className="av">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                  <div className="why">
                    <b>{fullName}</b>
                    <div className="s">
                      {c.procedureDescription ?? c.procedureCode ?? 'Procedure tbd'}
                      {' · stuck in '}
                      {COLUMNS.find((x) => x.col === colFor(c))?.title ?? c.status}
                    </div>
                  </div>
                  <span className="age">{ageHours}h</span>
                </Link>
              );
            })}
            {stuck.length === 0 && cases && cases.length > 0 && (
              <div className="muted" style={{ padding: '0.5rem 0', fontSize: '0.875rem' }}>
                Every active case has had activity in the last 48h.
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>This week</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {week.map((w) => (
              <div key={w.day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--ink-500)' }}>{w.day}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {w.count === 0 ? '—' : `${w.count} ${w.count === 1 ? 'surgery' : 'surgeries'}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-banner">
        <b>AI-drafted activity</b> on every card. Each move between columns fires the right agent —
        Intake → Risk, Clearance → Anesthesia, Scheduling → Comms.
      </div>

      {loading && !cases && <div className="muted" style={{ marginTop: 24 }}>Loading board…</div>}

      {grouped && (
        <div className="kanban">
          {COLUMNS.map((b) => {
            const items = grouped[b.col];
            const stepIdx = STEPS_FOR[b.col];
            return (
              <div className={`kcol ${b.col}`} key={b.col}>
                <div className="kh">
                  <span className="kt">{b.title}</span>
                  <span className="kc">{items.length}</span>
                </div>
                {items.length === 0 && (
                  <div className="muted" style={{ fontSize: '0.8125rem', padding: '0.5rem' }}>
                    Empty.
                  </div>
                )}
                {items.map((c) => {
                  const p = patients.get(c.patientId);
                  const surgeon = c.surgeonId ? surgeons.get(c.surgeonId) : null;
                  const runs = runsByCase.get(c.id) ?? [];
                  const isStuck = hoursSince(c.updatedAt) >= 48;
                  const aiLatest = runs[0];
                  const tag = aiLatest ? (AI_TAG[aiLatest.agentKey] ?? aiLatest.agentKey) : 'No agent activity';
                  return (
                    <Link
                      key={c.id}
                      className={`kcard${isStuck ? ' stuck' : ''}`}
                      href={`/app/coordinator/cases/${c.id}`}
                    >
                      <div className="top">
                        <span className="av">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                        <div>
                          <div className="nm">{p ? `${p.firstName} ${p.lastName}` : 'Unknown'}</div>
                          <div className="pr">
                            {c.procedureDescription ?? c.procedureCode ?? '—'}
                            {surgeon && ` · Dr. ${surgeon.lastName}`}
                          </div>
                        </div>
                      </div>
                      <div className="bar">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span key={i} className={`seg${i < stepIdx ? ' on' : ''}`} />
                        ))}
                      </div>
                      <div className="meta">
                        <span className="when">{relativeAge(c)}</span>
                        <span className="ai">◆ {tag}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
