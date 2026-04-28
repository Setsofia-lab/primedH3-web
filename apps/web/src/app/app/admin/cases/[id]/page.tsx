'use client';

/**
 * Admin · Case detail — same cockpit visual as the surgeon view, plus
 * an Edit tab for status / surgeon / scheduling fields. Reads + writes
 * via /api/admin/cases/:id.
 */
import Link from 'next/link';
import { useEffect, useState, useMemo, use } from 'react';
import { AgentActivityCard } from '@/components/agents/AgentActivityCard';
import { AgentsPanel } from '@/components/cases/AgentsPanel';
import { AppShell } from '@/components/shell/AppShell';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { MessagesPanel } from '@/components/messages/MessagesPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';
type TabKey = 'overview' | 'hp' | 'plan' | 'workup' | 'notes' | 'edit';

interface CaseRow {
  id: string;
  facilityId: string;
  patientId: string;
  surgeonId: string | null;
  coordinatorId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  readinessScore: number | null;
  surgeryDate: string | null;
  clearedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface Patient {
  id: string; firstName: string; lastName: string; dob: string; sex: string | null;
  mrn: string | null; athenaResourceId: string | null; athenaPracticeId: string | null;
  athenaLastSyncAt: string | null;
}
interface User { id: string; firstName: string; lastName: string; role: string }
interface Task { id: string; status: 'pending' | 'in_progress' | 'done' | 'blocked' }
interface AgentRun {
  id: string; agentKey: string; status: 'queued' | 'running' | 'succeeded' | 'failed';
  outputJson: unknown; createdAt: string;
}

const STATUSES: CaseStatus[] = [
  'referral', 'workup', 'clearance', 'pre_hab', 'ready', 'completed', 'cancelled',
];

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
function fmtDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
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

export default function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CaseRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [surgeon, setSurgeon] = useState<User | null>(null);
  const [allSurgeons, setAllSurgeons] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const [eStatus, setEStatus] = useState<CaseStatus>('referral');
  const [eSurgeonId, setESurgeonId] = useState<string>('');
  const [eCode, setECode] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eDate, setEDate] = useState('');
  const [eReadiness, setEReadiness] = useState('');

  async function load() {
    setError(null);
    try {
      const caseRow = await jsonOrThrow<CaseRow>(await fetch(`/api/admin/cases/${id}`));
      setC(caseRow);
      setEStatus(caseRow.status);
      setESurgeonId(caseRow.surgeonId ?? '');
      setECode(caseRow.procedureCode ?? '');
      setEDesc(caseRow.procedureDescription ?? '');
      setEDate(fmtDateInput(caseRow.surgeryDate));
      setEReadiness(caseRow.readinessScore == null ? '' : String(caseRow.readinessScore));

      const [allP, allU, t, r] = await Promise.all([
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/admin/patients?limit=200')),
        jsonOrThrow<{ items: User[] }>(await fetch('/api/admin/users?role=surgeon&limit=200')),
        jsonOrNull<{ items: Task[] }>(await fetch(`/api/tasks?caseId=${id}&limit=200`)),
        jsonOrNull<{ items: AgentRun[] }>(await fetch(`/api/cases/${id}/agent-runs?limit=50`)),
      ]);
      setPatient(allP.items.find((p) => p.id === caseRow.patientId) ?? null);
      setAllSurgeons(allU.items);
      setSurgeon(caseRow.surgeonId ? (allU.items.find((u) => u.id === caseRow.surgeonId) ?? null) : null);
      setTasks(t?.items ?? []);
      setRuns(r?.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  const doneCount = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks]);
  const latestDoc = useMemo(() => runs.find((r) => r.agentKey === 'documentation' && r.status === 'succeeded') ?? null, [runs]);
  const latestIntake = useMemo(() => runs.find((r) => r.agentKey === 'intake_orchestrator' && r.status === 'succeeded') ?? null, [runs]);
  const latestRisk = useMemo(() => runs.find((r) => r.agentKey === 'risk_screening' && r.status === 'succeeded') ?? null, [runs]);
  const latestAnesthesia = useMemo(() => runs.find((r) => r.agentKey === 'anesthesia_clearance' && r.status === 'succeeded') ?? null, [runs]);

  async function dispatchAgent(agentKey: string): Promise<void> {
    try {
      const res = await fetch(`/api/admin/cases/${id}/dispatch-agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKey }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTimeout(() => void load(), 2500);
    } catch (e) { setError((e as Error).message); }
  }

  async function save() {
    if (!c) return;
    setSaving(true); setSaveOk(null); setError(null);
    try {
      const body: Record<string, unknown> = {
        status: eStatus,
        surgeonId: eSurgeonId || null,
        procedureCode: eCode.trim() || null,
        procedureDescription: eDesc.trim() || null,
        surgeryDate: eDate ? new Date(eDate).toISOString() : null,
        readinessScore: eReadiness === '' ? null : Math.max(0, Math.min(100, Number(eReadiness))),
      };
      const updated = await jsonOrThrow<CaseRow>(
        await fetch(`/api/admin/cases/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }),
      );
      setC(updated);
      setSaveOk('Saved.');
      setSurgeon(updated.surgeonId ? (allSurgeons.find((u) => u.id === updated.surgeonId) ?? null) : null);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  if (!c && !error) {
    return <AppShell breadcrumbs={['Admin', 'Cases', 'Loading…']}><div className="muted">Loading…</div></AppShell>;
  }
  if (!c) {
    return (
      <AppShell breadcrumbs={['Admin', 'Cases', 'Error']}>
        <div className="card">
          <div style={{ color: 'var(--danger, #c0392b)' }}>{error}</div>
          <Link href="/app/admin/cases" className="btn btn-outline-dark" style={{ marginTop: 12 }}>← All cases</Link>
        </div>
      </AppShell>
    );
  }

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : c.patientId.slice(0, 8);
  const days = daysTo(c.surgeryDate);

  return (
    <AppShell breadcrumbs={['Admin', 'Cases', patientName]}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/app/admin/cases" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}>
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
        <button type="button" className={tab === 'edit' ? 'active' : undefined} onClick={() => setTab('edit')}>Edit</button>
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
                <dt>Athena practice</dt><dd>{patient?.athenaPracticeId ?? '—'}</dd>
                <dt>Last Athena sync</dt>
                <dd className="muted">{patient?.athenaLastSyncAt ? new Date(patient.athenaLastSyncAt).toLocaleString() : '—'}</dd>
                <dt>Procedure</dt><dd>{c.procedureDescription ?? '—'}</dd>
                <dt>CPT</dt><dd>{c.procedureCode ? <code>{c.procedureCode}</code> : '—'}</dd>
                <dt>Surgeon</dt><dd>{surgeon ? `Dr. ${surgeon.firstName} ${surgeon.lastName}` : <span className="muted">unassigned</span>}</dd>
                <dt>Surgery date</dt><dd>{c.surgeryDate ? fmtDate(c.surgeryDate) : 'unscheduled'}</dd>
                <dt>Created</dt><dd className="muted">{new Date(c.createdAt).toLocaleString()}</dd>
                <dt>Last updated</dt><dd className="muted">{new Date(c.updatedAt).toLocaleString()}</dd>
                {c.clearedAt && (<><dt>Cleared at</dt><dd>{new Date(c.clearedAt).toLocaleString()}</dd></>)}
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
                    <div className="readiness-bar"><div className="track"><div className="fill" style={{ width: `${c.readinessScore ?? 0}%` }} /></div></div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: '0.375rem' }}>
                      {readinessHint(c.readinessScore)}
                    </div>
                  </div>
                </div>
              </div>
              <AgentsPanel caseId={c.id} />
              <AgentActivityCard source="case" caseId={c.id} title="Agent activity" limit={8} compact />
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
            primaryLabel="Sign H&P"
            onPrimary={() => { /* signature endpoint TBD */ }}
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
            primaryLabel="Approve plan"
            onPrimary={() => { /* signature endpoint TBD */ }}
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

      {tab === 'edit' && (
        <section className="tab-pane active">
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '0.75rem' }}><h3>Edit case</h3></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Status</div>
                <select className="input" value={eStatus} onChange={(e) => setEStatus(e.target.value as CaseStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Surgeon</div>
                <select className="input" value={eSurgeonId} onChange={(e) => setESurgeonId(e.target.value)}>
                  <option value="">— unassigned —</option>
                  {allSurgeons.map((s) => (
                    <option key={s.id} value={s.id}>Dr. {s.lastName}, {s.firstName}</option>
                  ))}
                </select>
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Surgery date</div>
                <input className="input" type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Readiness (0–100)</div>
                <input className="input" inputMode="numeric" value={eReadiness} onChange={(e) => setEReadiness(e.target.value)} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <div className="muted" style={{ marginBottom: 4 }}>CPT</div>
                <input className="input" value={eCode} onChange={(e) => setECode(e.target.value)} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <div className="muted" style={{ marginBottom: 4 }}>Description</div>
                <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saveOk && <span className="muted">{saveOk}</span>}
              {error && <span style={{ color: 'var(--danger, #c0392b)' }}>{error}</span>}
            </div>
          </div>
        </section>
      )}

      <div className="sign-off-bar">
        <div className="lbl">
          {tab === 'edit'
            ? 'Edit fields above and Save. Audit log captures every mutation.'
            : 'Trigger any agent on demand from the Overview Agents panel; runs land in the activity feed in real time.'}
        </div>
        <button className="btn btn-ghost-dark" onClick={() => void dispatchAgent('readiness')}>
          Recompute readiness
        </button>
        <Link href="/app/admin/agents" className="btn btn-primary">Open prompt registry</Link>
      </div>
    </AppShell>
  );
}

/* ---------- Shared cockpit components ---------- */

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
        <span>AI-DRAFTED · REVIEW BEFORE SIGNING</span>
        <span className="sp" />
        <span className="agent">
          {run ? `from ${run.agentKey} run · ${new Date(run.createdAt).toLocaleString()}` : 'no draft yet — click "Re-draft" to generate'}
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

interface DocBody { kind?: string; title?: string; sections?: Array<{ key: string; heading: string; body: string }>; reviewerFocus?: string }
function DocumentBody({ output, fallbackPatient, fallbackProcedure }: { output: unknown; fallbackPatient: string; fallbackProcedure: string }) {
  const o = output as DocBody | null;
  if (!o || !o.sections) {
    return <p>{fallbackPatient}, scheduled for <b>{fallbackProcedure.toLowerCase()}</b>. Draft will populate once the DocumentationAgent finishes.</p>;
  }
  return (
    <>
      {o.sections.map((s) => (
        <div key={s.key}><h4>{s.heading}</h4><p style={{ whiteSpace: 'pre-wrap' }}>{s.body}</p></div>
      ))}
      {o.reviewerFocus && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-500)' }}>
          <strong>Reviewer focus:</strong> {o.reviewerFocus}
        </div>
      )}
    </>
  );
}

interface IntakePayload {
  tasks?: Array<{ title: string; description?: string; assigneeRole: string; dueInDays?: number }>;
  rationale?: string;
}
interface RiskPayload { overallScore?: number; summary?: string; risks?: Array<{ category: string; name: string; severity: string }> }
interface AnesthesiaPayload { asa?: string | number; draftNote?: string; reviewerFocus?: string }
function PlanBody({ output, risk, anesthesia, procedure, cpt }: {
  output: unknown; risk: unknown; anesthesia: unknown; procedure: string; cpt: string | null;
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
                <b>{t.title}</b>{t.description ? ` — ${t.description}` : ''}
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
              Overall score: {(r.overallScore * 100).toFixed(0)}%.
            </p>
          )}
        </>
      )}
      {a && (
        <>
          <h4>Anesthesia draft</h4>
          {a.asa != null && <p>ASA: <b>{a.asa}</b></p>}
          {a.draftNote && <p style={{ whiteSpace: 'pre-wrap' }}>{a.draftNote}</p>}
        </>
      )}
    </>
  );
}
