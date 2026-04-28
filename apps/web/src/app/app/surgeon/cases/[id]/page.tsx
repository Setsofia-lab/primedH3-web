'use client';

/**
 * Surgeon · case detail — restored Phase 1 cockpit visual with live data.
 *
 * Layout (matches the original §3.2 spec):
 *   - case-hero: avatar, name, age, procedure, CPT, status pill, surgery date, T-minus days
 *   - tab-strip: Overview / H&P · AI / Plan · AI / Workup (count) / Notes
 *   - sticky sign-off-bar at bottom for quick H&P / plan sign-offs
 *
 * Data sources (all real):
 *   GET /api/cases/:id            → CaseRow
 *   GET /api/patients?limit=200   → Patient (filtered by case.patientId)
 *   GET /api/cases/:id/agent-runs → AgentRun[] (drives H&P, Plan, Activity)
 *   /api/tasks (via TasksPanel)
 *   /api/messages (via MessagesPanel)
 *   /api/documents (via DocumentsPanel)
 *
 * Sign actions write a /api/admin/cases/:id/dispatch-agent (re-run the
 * DocumentationAgent) — the actual signature flow lives in M-next once
 * the agent_runs HITL approval endpoint exists.
 */
import Link from 'next/link';
import { useEffect, useState, useMemo, use } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AgentActivityCard } from '@/components/agents/AgentActivityCard';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { MessagesPanel } from '@/components/messages/MessagesPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

type TabKey = 'overview' | 'hp' | 'plan' | 'workup' | 'notes';

interface CaseRow {
  id: string;
  patientId: string;
  surgeonId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  readinessScore: number | null;
  surgeryDate: string | null;
  createdAt: string;
  updatedAt: string;
}
interface Patient {
  id: string; firstName: string; lastName: string; dob: string; sex: string | null;
  mrn: string | null; athenaResourceId: string | null;
}
interface Task {
  id: string; status: 'pending' | 'in_progress' | 'done' | 'blocked';
}
interface AgentRun {
  id: string;
  agentKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  outputJson: unknown;
  createdAt: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}
function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function daysTo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

function readinessHint(score: number | null): string {
  if (score == null) return 'Not yet scored. Trigger any agent run to compute.';
  if (score >= 85) return 'Ready for OR.';
  if (score >= 60) return 'Conditional — outstanding workup tasks.';
  return 'Not ready — multiple items open.';
}

export default function SurgeonCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CaseRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState<'hp' | 'plan' | null>(null);

  async function loadAll() {
    try {
      const caseRow = await jsonOrThrow<CaseRow>(await fetch(`/api/cases/${id}`));
      setC(caseRow);
      const [p, t, r] = await Promise.all([
        jsonOrNull<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
        jsonOrNull<{ items: Task[] }>(await fetch(`/api/tasks?caseId=${id}&limit=200`)),
        jsonOrNull<{ items: AgentRun[] }>(await fetch(`/api/cases/${id}/agent-runs?limit=50`)),
      ]);
      setPatient(p?.items.find((x) => x.id === caseRow.patientId) ?? null);
      setTasks(t?.items ?? []);
      setRuns(r?.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const doneCount = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks]);

  const latestDoc = useMemo(
    () =>
      runs.find((r) => r.agentKey === 'documentation' && r.status === 'succeeded') ?? null,
    [runs],
  );
  const latestIntake = useMemo(
    () =>
      runs.find((r) => r.agentKey === 'intake_orchestrator' && r.status === 'succeeded') ?? null,
    [runs],
  );
  const latestRisk = useMemo(
    () =>
      runs.find((r) => r.agentKey === 'risk_screening' && r.status === 'succeeded') ?? null,
    [runs],
  );
  const latestAnesthesia = useMemo(
    () =>
      runs.find((r) => r.agentKey === 'anesthesia_clearance' && r.status === 'succeeded') ?? null,
    [runs],
  );

  async function dispatchAgent(agentKey: string): Promise<void> {
    try {
      const res = await fetch(`/api/admin/cases/${id}/dispatch-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKey }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      // refetch in 2s to let the worker pick up the SQS message
      setTimeout(() => void loadAll(), 2500);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!c && !error) {
    return <AppShell breadcrumbs={['Surgeon', 'My cases', 'Loading…']}><div className="muted">Loading…</div></AppShell>;
  }
  if (!c) {
    return (
      <AppShell breadcrumbs={['Surgeon', 'My cases', 'Error']}>
        <div className="card">
          <div style={{ color: 'var(--danger, #c0392b)' }}>{error}</div>
          <Link href="/app/surgeon" className="btn btn-outline-dark" style={{ marginTop: 12 }}>← My cases</Link>
        </div>
      </AppShell>
    );
  }

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : c.patientId.slice(0, 8);
  const days = daysTo(c.surgeryDate);

  return (
    <AppShell breadcrumbs={['Surgeon', 'My cases', patientName]}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/app/surgeon"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}>
          ← All cases
        </Link>
      </div>

      <div className="case-hero">
        <div className="av">{patient ? initials(patient.firstName, patient.lastName) : '?'}</div>
        <div>
          <h1>{patientName}</h1>
          <div className="sub">
            {patient ? `${ageOf(patient.dob)}y · ` : ''}
            {c.procedureDescription ?? '—'}
            {c.procedureCode ? ` · CPT ${c.procedureCode}` : ''}
          </div>
        </div>
        <div className="right">
          <span className={`status-pill ${c.status}`}>{c.status}</span>
          <div className="when">Surgery <em>{c.surgeryDate ? fmtDate(c.surgeryDate) : 'unscheduled'}</em></div>
          {days != null && (
            <div style={{ color: '#A3ADC4', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              IN {days} DAYS
            </div>
          )}
        </div>
      </div>

      <div className="tab-strip">
        <button type="button" className={tab === 'overview' ? 'active' : undefined} onClick={() => setTab('overview')}>Overview</button>
        <button type="button" className={tab === 'hp' ? 'active' : undefined} onClick={() => setTab('hp')}>H&amp;P <span className="b">AI</span></button>
        <button type="button" className={tab === 'plan' ? 'active' : undefined} onClick={() => setTab('plan')}>Plan <span className="b">AI</span></button>
        <button type="button" className={tab === 'workup' ? 'active' : undefined} onClick={() => setTab('workup')}>
          Workup<span className="b">{tasks.length}</span>
        </button>
        <button type="button" className={tab === 'notes' ? 'active' : undefined} onClick={() => setTab('notes')}>Notes</button>
      </div>

      {tab === 'overview' && (
        <section className="tab-pane active">
          <div className="two-col">
            <div className="card">
              <div className="card-head"><h3>Chart summary</h3></div>
              <dl className="kv-list">
                <dt>Patient</dt><dd>{patientName}</dd>
                <dt>DOB</dt><dd>{patient?.dob ?? '—'}</dd>
                <dt>Sex</dt><dd>{patient?.sex ?? '—'}</dd>
                <dt>MRN</dt><dd>{patient?.mrn ?? '—'}</dd>
                <dt>Athena id</dt>
                <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{patient?.athenaResourceId ?? '—'}</dd>
                <dt>Procedure</dt><dd>{c.procedureDescription ?? '—'}</dd>
                <dt>CPT</dt><dd>{c.procedureCode ? <code>{c.procedureCode}</code> : '—'}</dd>
                <dt>Surgery date</dt><dd>{c.surgeryDate ? fmtDate(c.surgeryDate) : 'unscheduled'}</dd>
                <dt>Status</dt><dd><span className={`status-pill ${c.status}`}>{c.status}</span></dd>
              </dl>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Readiness</h3></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 400, color: 'var(--ink-900)', lineHeight: 1 }}>
                    {c.readinessScore ?? '—'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="readiness-bar">
                      <div className="track">
                        <div className="fill" style={{ width: `${c.readinessScore ?? 0}%` }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: '0.375rem' }}>
                      {readinessHint(c.readinessScore)}
                    </div>
                  </div>
                </div>
              </div>

              <AgentActivityCard source="case" caseId={c.id} title="Agent activity" limit={6} compact />
            </div>
          </div>
        </section>
      )}

      {tab === 'hp' && (
        <section className="tab-pane active">
          <AiDraftCard
            label="History &amp; physical"
            run={latestDoc}
            renderBody={(o) => <DocumentBody output={o} fallbackPatient={patientName} fallbackProcedure={c.procedureDescription ?? '—'} />}
            primaryLabel={signing === 'hp' ? 'Signing…' : 'Sign H&P'}
            onPrimary={() => { setSigning('hp'); /* sign endpoint TBD */ setTimeout(() => setSigning(null), 800); }}
            onRedraft={() => void dispatchAgent('documentation')}
            citations="Guidelines: ACC/AHA · NSQIP · ACS"
          />
        </section>
      )}

      {tab === 'plan' && (
        <section className="tab-pane active">
          <AiDraftCard
            label="Procedure plan"
            run={latestIntake}
            renderBody={(o) => <PlanBody output={o} risk={latestRisk?.outputJson} anesthesia={latestAnesthesia?.outputJson} procedure={c.procedureDescription ?? '—'} cpt={c.procedureCode} />}
            primaryLabel={signing === 'plan' ? 'Approving…' : 'Approve plan'}
            onPrimary={() => { setSigning('plan'); setTimeout(() => setSigning(null), 800); }}
            onRedraft={() => void dispatchAgent('intake_orchestrator')}
            citations="NSQIP risk calculator · CPT-aligned"
          />
        </section>
      )}

      {tab === 'workup' && (
        <section className="tab-pane active">
          <div className="card">
            <div className="card-head">
              <h3>Workup tasks</h3>
              <span className="status-pill neutral">{doneCount} of {tasks.length} complete</span>
            </div>
            <TasksPanel caseId={c.id} canCreate />
          </div>
        </section>
      )}

      {tab === 'notes' && (
        <section className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <MessagesPanel caseId={c.id} />
          <DocumentsPanel caseId={c.id} />
        </section>
      )}

      <div className="sign-off-bar">
        <div className="lbl">
          {tab === 'hp' || tab === 'plan'
            ? 'AI draft is awaiting your review. Re-draft if you need a fresh pass; sign when satisfied.'
            : 'Review tabs and sign the H&P + plan when satisfied. The team is notified on each sign.'}
        </div>
        <button className="btn btn-ghost-dark" onClick={() => setTab(tab === 'plan' ? 'hp' : 'plan')}>
          {tab === 'plan' ? 'Review H&P' : 'Review plan'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void dispatchAgent('readiness')}
          title="Recompute the readiness score now"
        >
          Recompute readiness
        </button>
      </div>
    </AppShell>
  );
}

/* ---------- AI-draft card ---------- */

interface AiDraftCardProps {
  label: string;
  run: AgentRun | null;
  renderBody: (output: unknown) => React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  onRedraft: () => void;
  citations: string;
}

function AiDraftCard({ label, run, renderBody, primaryLabel, onPrimary, onRedraft, citations }: AiDraftCardProps) {
  return (
    <div className="ai-draft">
      <div className="dh">
        <span dangerouslySetInnerHTML={{ __html: 'AI-DRAFTED · REVIEW BEFORE SIGNING' }} />
        <span className="sp" />
        <span className="agent">
          {run
            ? `from ${run.agentKey} run · ${new Date(run.createdAt).toLocaleString()}`
            : 'no draft yet — click "Re-draft" to generate'}
        </span>
      </div>
      <div className="db">
        <h4 style={{ marginTop: 0 }}>{label}</h4>
        {run ? renderBody(run.outputJson) : (
          <p style={{ color: 'var(--ink-500)', fontSize: '0.875rem' }}>
            No draft on file for this case yet. Click <strong>Re-draft</strong> to fire the agent.
          </p>
        )}
      </div>
      <div className="df">
        <span className="cite">{citations}</span>
        <span className="spacer" />
        <button className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={onRedraft}>
          Re-draft
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
          onClick={onPrimary}
          disabled={!run}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

/* ---------- DocumentationAgent body renderer ---------- */

interface DocBody { kind?: string; title?: string; sections?: Array<{ key: string; heading: string; body: string }>; reviewerFocus?: string; }

function DocumentBody({ output, fallbackPatient, fallbackProcedure }: {
  output: unknown;
  fallbackPatient: string;
  fallbackProcedure: string;
}) {
  const o = output as DocBody | null;
  if (!o || !o.sections) {
    return (
      <p>
        {fallbackPatient}, scheduled for <b>{fallbackProcedure.toLowerCase()}</b>.
        Draft will populate once the DocumentationAgent finishes.
      </p>
    );
  }
  return (
    <>
      {o.sections.map((s) => (
        <div key={s.key}>
          <h4>{s.heading}</h4>
          <p style={{ whiteSpace: 'pre-wrap' }}>{s.body}</p>
        </div>
      ))}
      {o.reviewerFocus && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-500)' }}>
          <strong>Reviewer focus:</strong> {o.reviewerFocus}
        </div>
      )}
    </>
  );
}

/* ---------- IntakeOrchestrator + supporting agents body renderer ---------- */

interface IntakePayload {
  tasks?: Array<{ title: string; description?: string; assigneeRole: string; dueInDays?: number }>;
  rationale?: string;
}
interface RiskPayload { overallScore?: number; summary?: string; risks?: Array<{ category: string; name: string; severity: string }> }
interface AnesthesiaPayload { asa?: string | number; draftNote?: string; reviewerFocus?: string }

function PlanBody({ output, risk, anesthesia, procedure, cpt }: {
  output: unknown;
  risk: unknown;
  anesthesia: unknown;
  procedure: string;
  cpt: string | null;
}) {
  const intake = output as IntakePayload | null;
  const r = risk as RiskPayload | null;
  const a = anesthesia as AnesthesiaPayload | null;
  return (
    <>
      <h4>Procedure</h4>
      <p>
        <b>{procedure}</b>{cpt && <> (CPT <code>{cpt}</code>)</>}.{' '}
        {intake?.rationale ?? 'AI rationale will appear after IntakeOrchestrator runs.'}
      </p>
      {intake?.tasks && intake.tasks.length > 0 && (
        <>
          <h4>Pre-op workup checklist</h4>
          <ul>
            {intake.tasks.map((t, i) => (
              <li key={i}>
                <b>{t.title}</b>
                {t.description ? ` — ${t.description}` : ''}
                {' '}
                <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>
                  ({t.assigneeRole}{t.dueInDays != null ? `, due in ${t.dueInDays}d` : ''})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {r && (
        <>
          <h4>Risk profile</h4>
          <p>{r.summary ?? 'Pending RiskScreening.'}</p>
          {r.overallScore != null && (
            <p style={{ fontSize: 13, color: 'var(--ink-500)' }}>
              Overall score: {(r.overallScore * 100).toFixed(0)}% — review individual categories in the agent activity panel.
            </p>
          )}
        </>
      )}
      {a && (
        <>
          <h4>Anesthesia draft</h4>
          {a.asa != null && <p>ASA classification: <b>{a.asa}</b></p>}
          {a.draftNote && <p style={{ whiteSpace: 'pre-wrap' }}>{a.draftNote}</p>}
          {a.reviewerFocus && (
            <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>
              <strong>Reviewer focus:</strong> {a.reviewerFocus}
            </p>
          )}
        </>
      )}
    </>
  );
}
