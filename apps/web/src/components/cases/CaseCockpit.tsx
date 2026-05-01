'use client';

/**
 * CaseCockpit — single shared case-detail layout used identically by
 * admin / surgeon / anesthesia / coordinator. Same tabs, same cards,
 * same sign-off bar. Role only changes:
 *   - which API endpoint serves the case row (admin reads
 *     /api/admin/cases/:id; everyone else reads /api/cases/:id —
 *     both return the same shape)
 *   - whether the Edit tab form is enabled (admin-only — non-admins
 *     see the same tab + form structure but Save is disabled and a
 *     banner explains why)
 *   - the back link / breadcrumbs (per-role parent route)
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AgentsPanel } from '@/components/cases/AgentsPanel';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { MessagesPanel } from '@/components/messages/MessagesPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';
type TabKey = 'overview' | 'hp' | 'plan' | 'workup' | 'notes' | 'edit';
type Role = 'admin' | 'surgeon' | 'anesthesia' | 'coordinator';

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
  id: string; agentKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  hitlStatus: 'n_a' | 'pending' | 'approved' | 'declined';
  outputJson: unknown; errorMessage: string | null;
  triggerEvent: string;
  totalCostUsdMicros: number | null; latencyMs: number | null;
  createdAt: string;
}

const STATUSES: CaseStatus[] = [
  'referral', 'workup', 'clearance', 'pre_hab', 'ready', 'completed', 'cancelled',
];

const AGENT_TAG_LABEL: Record<string, string> = {
  intake_orchestrator: 'IntakeOrch',
  risk_screening: 'RiskScreen',
  anesthesia_clearance: 'Anesthesia',
  scheduling: 'Sched',
  referral: 'Referral',
  patient_comms: 'Comms',
  pre_hab: 'PreHab',
  documentation: 'Docs',
  task_tracker: 'Tasks',
  readiness: 'Readiness',
};

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
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function summarizeRun(r: AgentRun): string {
  const o = r.outputJson;
  if (!o || typeof o !== 'object') return r.triggerEvent;
  const obj = o as Record<string, unknown>;
  const summary = obj.summary ?? obj.narrative ?? obj.draftReply ?? obj.patientSummary;
  if (typeof summary === 'string' && summary.length > 0) {
    return summary.length > 80 ? `${summary.slice(0, 80)}…` : summary;
  }
  return r.triggerEvent;
}

interface Props {
  role: Role;
  caseId: string;
  /** Where the "← All cases" link goes. */
  backHref: string;
  backLabel: string;
}

export function CaseCockpit({ role, caseId, backHref, backLabel }: Props) {
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

  const isAdmin = role === 'admin';
  const caseEndpoint = isAdmin ? `/api/admin/cases/${caseId}` : `/api/cases/${caseId}`;
  const patientsEndpoint = isAdmin ? '/api/admin/patients?limit=200' : '/api/patients?limit=200';

  async function load() {
    setError(null);
    try {
      const caseRow = await jsonOrThrow<CaseRow>(await fetch(caseEndpoint));
      setC(caseRow);
      setEStatus(caseRow.status);
      setESurgeonId(caseRow.surgeonId ?? '');
      setECode(caseRow.procedureCode ?? '');
      setEDesc(caseRow.procedureDescription ?? '');
      setEDate(fmtDateInput(caseRow.surgeryDate));
      setEReadiness(caseRow.readinessScore == null ? '' : String(caseRow.readinessScore));

      const [pRes, tRes, rRes, uRes] = await Promise.all([
        jsonOrNull<{ items: Patient[] }>(await fetch(patientsEndpoint)),
        jsonOrNull<{ items: Task[] }>(await fetch(`/api/tasks?caseId=${caseId}&limit=200`)),
        jsonOrNull<{ items: AgentRun[] }>(await fetch(`/api/cases/${caseId}/agent-runs?limit=50`)),
        // Surgeons list is admin-only — non-admins see read-only surgeon name
        isAdmin
          ? jsonOrNull<{ items: User[] }>(await fetch('/api/admin/users?role=surgeon&limit=200'))
          : Promise.resolve({ items: [] as User[] }),
      ]);
      setPatient(pRes?.items.find((p) => p.id === caseRow.patientId) ?? null);
      setTasks(tRes?.items ?? []);
      setRuns(rRes?.items ?? []);
      setAllSurgeons(uRes?.items ?? []);
      setSurgeon(
        caseRow.surgeonId && uRes?.items
          ? (uRes.items.find((u) => u.id === caseRow.surgeonId) ?? null)
          : null,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  const doneCount = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks]);
  const latestDoc = useMemo(() => runs.find((r) => r.agentKey === 'documentation' && r.status === 'succeeded') ?? null, [runs]);
  const latestIntake = useMemo(() => runs.find((r) => r.agentKey === 'intake_orchestrator' && r.status === 'succeeded') ?? null, [runs]);
  const latestRisk = useMemo(() => runs.find((r) => r.agentKey === 'risk_screening' && r.status === 'succeeded') ?? null, [runs]);
  const latestAnesthesia = useMemo(() => runs.find((r) => r.agentKey === 'anesthesia_clearance' && r.status === 'succeeded') ?? null, [runs]);

  async function dispatchAgent(agentKey: string): Promise<void> {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/dispatch-agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKey }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTimeout(() => void load(), 2500);
    } catch (e) { setError((e as Error).message); }
  }

  async function save() {
    if (!c || !isAdmin) return;
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
        await fetch(`/api/admin/cases/${caseId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }),
      );
      setC(updated);
      setSaveOk('Saved.');
      setSurgeon(updated.surgeonId ? (allSurgeons.find((u) => u.id === updated.surgeonId) ?? null) : null);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  if (!c && !error) {
    return <div className="muted">Loading…</div>;
  }
  if (!c) {
    return (
      <div className="card">
        <div style={{ color: 'var(--danger, #c0392b)' }}>{error}</div>
        <Link href={backHref} className="btn btn-outline-dark" style={{ marginTop: 12 }}>
          ← {backLabel}
        </Link>
      </div>
    );
  }

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : c.patientId.slice(0, 8);
  const days = daysTo(c.surgeryDate);

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <Link href={backHref} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}>
          ← {backLabel}
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
        <button type="button" className={tab === 'hp' ? 'active' : undefined} onClick={() => setTab('hp')}>H&amp;P</button>
        <button type="button" className={tab === 'plan' ? 'active' : undefined} onClick={() => setTab('plan')}>Pre-op</button>
        <button type="button" className={tab === 'workup' ? 'active' : undefined} onClick={() => setTab('workup')}>
          Tasks<span className="b">{tasks.length}</span>
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
                <dt>Surgeon</dt>
                <dd>
                  {surgeon
                    ? `Dr. ${surgeon.firstName} ${surgeon.lastName}`
                    : c.surgeonId ? <span className="muted">id {c.surgeonId.slice(0, 8)}</span> : <span className="muted">unassigned</span>}
                </dd>
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

              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Agent activity</h3></div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>
                  {runs.length === 0 ? (
                    <div className="muted" style={{ padding: '0.5rem 0' }}>
                      No agent runs yet. Trigger one from the Agents panel above.
                    </div>
                  ) : runs.slice(0, 6).map((r) => (
                    <div key={r.id} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0' }}>
                      <span className="agent-tag">{AGENT_TAG_LABEL[r.agentKey] ?? r.agentKey}</span>
                      {summarizeRun(r)} · {timeAgo(r.createdAt)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'hp' && (
        <section className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <AiDraftCard
            label="History &amp; physical"
            byline="AI-drafted"
            run={latestDoc}
            renderBody={(o) => <DocumentBody output={o} fallbackPatient={patientName} fallbackProcedure={c.procedureDescription ?? '—'} />}
            primaryLabel="Sign H&P"
            onPrimary={() => { /* signature endpoint TBD */ }}
            onRedraft={() => void dispatchAgent('documentation')}
          />
          <SurgeonAuthoredCard
            caseId={c.id}
            kind="hp"
            label="History &amp; physical"
            placeholder="Type your H&P here. The AI draft above is independent — your version is what gets signed."
          />
        </section>
      )}

      {tab === 'plan' && (
        <section className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <AiDraftCard
            label="Pre-op plan"
            byline="AI-drafted"
            run={latestIntake}
            renderBody={(o) => <PlanBody output={o} risk={latestRisk?.outputJson} anesthesia={latestAnesthesia?.outputJson} procedure={c.procedureDescription ?? '—'} cpt={c.procedureCode} />}
            primaryLabel="Approve plan"
            onPrimary={() => { /* signature endpoint TBD */ }}
            onRedraft={() => void dispatchAgent('intake_orchestrator')}
          />
          <SurgeonAuthoredCard
            caseId={c.id}
            kind="plan"
            label="Surgeon-edited plan"
            placeholder="Edit the AI plan or write your own. The version saved here is what your team executes."
          />
        </section>
      )}

      {tab === 'workup' && (
        <section className="tab-pane active">
          <div className="card">
            <div className="card-head">
              <h3>Tasks</h3>
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

            {!isAdmin && (
              <div className="muted" style={{
                background: 'var(--surface-100, #EEF1FA)',
                padding: '0.625rem 0.875rem',
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 13,
              }}>
                <strong>Read-only view.</strong> Editing case fields requires admin
                permissions — ask your facility admin if these need to change.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Status</div>
                <select className="input" value={eStatus} onChange={(e) => setEStatus(e.target.value as CaseStatus)} disabled={!isAdmin}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Surgeon</div>
                {isAdmin ? (
                  <select className="input" value={eSurgeonId} onChange={(e) => setESurgeonId(e.target.value)}>
                    <option value="">— unassigned —</option>
                    {allSurgeons.map((s) => (
                      <option key={s.id} value={s.id}>Dr. {s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" value={surgeon ? `Dr. ${surgeon.firstName} ${surgeon.lastName}` : eSurgeonId ? `id ${eSurgeonId.slice(0, 8)}` : 'unassigned'} disabled />
                )}
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Surgery date</div>
                <input className="input" type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} disabled={!isAdmin} />
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Readiness (0–100)</div>
                <input className="input" inputMode="numeric" value={eReadiness} onChange={(e) => setEReadiness(e.target.value)} disabled={!isAdmin} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <div className="muted" style={{ marginBottom: 4 }}>CPT</div>
                <input className="input" value={eCode} onChange={(e) => setECode(e.target.value)} disabled={!isAdmin} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <div className="muted" style={{ marginBottom: 4 }}>Description</div>
                <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} disabled={!isAdmin} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !isAdmin}>
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
          {tab === 'edit' && isAdmin
            ? 'Edit fields above and Save. Audit log captures every mutation.'
            : 'Trigger any agent on demand from the Agents panel; runs land in the activity feed in real time.'}
        </div>
        <button className="btn btn-ghost-dark" onClick={() => void dispatchAgent('readiness')}>
          Recompute readiness
        </button>
        <Link href="/app/admin/agents" className="btn btn-primary">Open prompt registry</Link>
      </div>
    </>
  );
}

/* ---------- Shared cockpit components ---------- */

interface AiDraftCardProps {
  label: string;
  /** Header eyebrow, e.g. "AI-drafted". */
  byline?: string;
  run: AgentRun | null;
  renderBody: (output: unknown) => React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  onRedraft: () => void;
}

function AiDraftCard({ label, byline = 'AI-drafted · review before signing', run, renderBody, primaryLabel, onPrimary, onRedraft }: AiDraftCardProps) {
  return (
    <div className="ai-draft">
      <div className="dh">
        <span>{byline.toUpperCase()}</span>
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
      <div className="df" style={{ justifyContent: 'flex-end' }}>
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

/**
 * SurgeonAuthoredCard — surgeon-typed counterpart to the AI-drafted
 * cards on the H&P + Pre-op tabs. Persists to localStorage keyed by
 * (caseId, kind) so the surgeon can edit and revisit. Clearly labelled
 * "Surgeon-authored" to distinguish from agent output. Server
 * persistence will swap this storage layer out without touching the
 * surface — see SAVE_KEY below.
 */
interface SurgeonAuthoredCardProps {
  caseId: string;
  kind: 'hp' | 'plan';
  label: string;
  placeholder: string;
}
function SurgeonAuthoredCard({ caseId, kind, label, placeholder }: SurgeonAuthoredCardProps) {
  const SAVE_KEY = `primed:case:${caseId}:${kind}`;
  const [text, setText] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { text: string; at: string };
        setText(parsed.text ?? '');
        setSavedAt(parsed.at ?? null);
      }
    } catch {
      // ignore corrupted entry
    }
    setHydrated(true);
  }, [SAVE_KEY]);

  function save() {
    const at = new Date().toISOString();
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ text, at }));
      setSavedAt(at);
      setDirty(false);
    } catch {
      // localStorage may be unavailable (Safari private mode). No-op.
    }
  }

  return (
    <div className="ai-draft" style={{ borderColor: 'var(--ink-300, #c5cdda)' }}>
      <div className="dh" style={{ background: '#fff7e6', color: '#a16207' }}>
        <span>SURGEON-AUTHORED</span>
        <span className="sp" />
        <span className="agent" style={{ color: '#a16207' }}>
          {savedAt
            ? `last saved ${new Date(savedAt).toLocaleString()}`
            : 'unsaved'}
        </span>
      </div>
      <div className="db">
        <h4 style={{ marginTop: 0 }}>{label}</h4>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setDirty(true); }}
          placeholder={placeholder}
          rows={8}
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0.625rem 0.75rem',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: 'var(--ink-900)',
            background: '#fff',
            resize: 'vertical',
            minHeight: 140,
          }}
          disabled={!hydrated}
        />
      </div>
      <div className="df" style={{ justifyContent: 'flex-end' }}>
        {dirty && (
          <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
            unsaved changes
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
          onClick={save}
          disabled={!dirty || !hydrated}
        >
          Save
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
