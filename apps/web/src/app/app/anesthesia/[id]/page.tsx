'use client';

/**
 * Anesthesia · case detail — same cockpit visual as surgeon/admin views,
 * with an Anesthesia · AI tab driven by the AnesthesiaClearanceAgent run
 * for this case. Clearance verdicts (Approved / Conditional / Defer)
 * write back via /api/admin/agent-runs/:runId/hitl, the same path that
 * already powers the admin runs panel.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState, use } from 'react';
import { AgentActivityCard } from '@/components/agents/AgentActivityCard';
import { AppShell } from '@/components/shell/AppShell';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { MessagesPanel } from '@/components/messages/MessagesPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';
type TabKey = 'overview' | 'anesthesia' | 'workup' | 'notes';

interface CaseRow {
  id: string;
  patientId: string;
  surgeonId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  readinessScore: number | null;
  surgeryDate: string | null;
}
interface Patient {
  id: string; firstName: string; lastName: string; dob: string; sex: string | null;
  mrn: string | null; athenaResourceId: string | null;
}
interface Task { id: string; status: 'pending' | 'in_progress' | 'done' | 'blocked' }
interface AgentRun {
  id: string; agentKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  hitlStatus: 'n_a' | 'pending' | 'approved' | 'declined';
  outputJson: unknown; createdAt: string;
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

export default function AnesthesiaCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CaseRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const caseRow = await jsonOrThrow<CaseRow>(await fetch(`/api/cases/${id}`));
      setC(caseRow);
      const [p, t, r] = await Promise.all([
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
        jsonOrNull<{ items: Task[] }>(await fetch(`/api/tasks?caseId=${id}&limit=200`)),
        jsonOrNull<{ items: AgentRun[] }>(await fetch(`/api/cases/${id}/agent-runs?limit=50`)),
      ]);
      setPatient(p.items.find((x) => x.id === caseRow.patientId) ?? null);
      setTasks(t?.items ?? []);
      setRuns(r?.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  const doneCount = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks]);
  const latestAnes = useMemo(
    () => runs.find((r) => r.agentKey === 'anesthesia_clearance' && r.status === 'succeeded') ?? null,
    [runs],
  );
  const latestRisk = useMemo(
    () => runs.find((r) => r.agentKey === 'risk_screening' && r.status === 'succeeded') ?? null,
    [runs],
  );

  async function dispatchAgent(agentKey: string): Promise<void> {
    setBusy('redraft');
    try {
      const res = await fetch(`/api/admin/cases/${id}/dispatch-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKey }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTimeout(() => void load(), 2500);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function decide(verdict: 'approved' | 'declined') {
    if (!latestAnes) return;
    setBusy(verdict);
    try {
      const res = await fetch(`/api/admin/agents/runs/${latestAnes.id}/hitl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      void load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (!c && !error) {
    return <AppShell breadcrumbs={['Anesthesia', 'Loading…']}><div className="muted">Loading…</div></AppShell>;
  }
  if (!c) {
    return (
      <AppShell breadcrumbs={['Anesthesia', 'Error']}>
        <div className="card">
          <div style={{ color: 'var(--danger, #c0392b)' }}>{error}</div>
          <Link href="/app/anesthesia" className="btn btn-outline-dark" style={{ marginTop: 12 }}>← Queue</Link>
        </div>
      </AppShell>
    );
  }

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : c.patientId.slice(0, 8);
  const days = daysTo(c.surgeryDate);

  return (
    <AppShell breadcrumbs={['Anesthesia', patientName]}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/app/anesthesia" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}>
          ← Queue
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
        <button type="button" className={tab === 'anesthesia' ? 'active' : undefined} onClick={() => setTab('anesthesia')}>Anesthesia <span className="b">AI</span></button>
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
                    <div className="readiness-bar"><div className="track"><div className="fill" style={{ width: `${c.readinessScore ?? 0}%` }} /></div></div>
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

      {tab === 'anesthesia' && (
        <section className="tab-pane active">
          <div className="ai-draft">
            <div className="dh">
              <span>AI-DRAFTED · REVIEW BEFORE CLEARING</span>
              <span className="sp" />
              <span className="agent">
                {latestAnes
                  ? `from anesthesia_clearance · ${new Date(latestAnes.createdAt).toLocaleString()}`
                  : 'no draft yet — click "Re-draft" to generate'}
              </span>
            </div>
            <div className="db">
              {latestAnes ? <AnesthesiaBody output={latestAnes.outputJson} risk={latestRisk?.outputJson} /> : (
                <p style={{ color: 'var(--ink-500)', fontSize: '0.875rem' }}>
                  No anesthesia draft for this case yet. Click <strong>Re-draft</strong> to fire the agent.
                </p>
              )}
            </div>
            <div className="df">
              <span className="cite">Guidelines: ASA · RCRI · STOP-BANG · AAGBI</span>
              <span className="spacer" />
              <button
                className="btn btn-ghost"
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => void dispatchAgent('anesthesia_clearance')}
                disabled={busy != null}
              >
                {busy === 'redraft' ? 'Re-drafting…' : 'Re-draft'}
              </button>
              <button
                className="btn btn-ghost-dark"
                style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                onClick={() => void decide('declined')}
                disabled={!latestAnes || busy != null}
              >
                {busy === 'declined' ? 'Saving…' : 'Defer'}
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                onClick={() => void decide('approved')}
                disabled={!latestAnes || busy != null}
              >
                {busy === 'approved' ? 'Saving…' : 'Approve'}
              </button>
            </div>
            {latestAnes && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-500)' }}>
                HITL state: <strong>{latestAnes.hitlStatus}</strong>
              </div>
            )}
          </div>
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
          {tab === 'anesthesia'
            ? 'Approve to clear · Defer to send back for further workup. The audit trail records every decision.'
            : 'Open the Anesthesia · AI tab to review the auto-drafted ASA / RCRI / STOP-BANG and clear the case.'}
        </div>
        <button className="btn btn-ghost-dark" onClick={() => setTab('anesthesia')}>Anesthesia draft</button>
        <Link href="/app/anesthesia/guidelines" className="btn btn-primary">Open guidelines</Link>
      </div>
    </AppShell>
  );
}

interface AnesthesiaPayload {
  asa?: string | number;
  asaRationale?: string;
  rcri?: { score?: number; components?: string[] };
  stopBang?: { score?: number; components?: string[] };
  airwayConcerns?: string;
  cardiopulmonaryConcerns?: string;
  draftNote?: string;
  reviewerFocus?: string;
  overallSeverity?: string;
}
interface RiskBody { overallScore?: number; summary?: string }

function AnesthesiaBody({ output, risk }: { output: unknown; risk: unknown }) {
  const a = output as AnesthesiaPayload | null;
  const r = risk as RiskBody | null;
  if (!a) return <p style={{ color: 'var(--ink-500)' }}>Draft loading…</p>;
  return (
    <>
      <h4>ASA classification</h4>
      <p>
        <b>{a.asa ?? '—'}</b>
        {a.asaRationale ? ` — ${a.asaRationale}` : ''}
      </p>
      {a.rcri && (
        <>
          <h4>RCRI (cardiac risk)</h4>
          <p>Score: <b>{a.rcri.score ?? '—'}</b></p>
          {a.rcri.components && a.rcri.components.length > 0 && (
            <ul>{a.rcri.components.map((c) => <li key={c}>{c}</li>)}</ul>
          )}
        </>
      )}
      {a.stopBang && (
        <>
          <h4>STOP-BANG (OSA screen)</h4>
          <p>Score: <b>{a.stopBang.score ?? '—'}</b></p>
          {a.stopBang.components && a.stopBang.components.length > 0 && (
            <ul>{a.stopBang.components.map((c) => <li key={c}>{c}</li>)}</ul>
          )}
        </>
      )}
      {a.airwayConcerns && (<><h4>Airway</h4><p style={{ whiteSpace: 'pre-wrap' }}>{a.airwayConcerns}</p></>)}
      {a.cardiopulmonaryConcerns && (<><h4>Cardiopulmonary</h4><p style={{ whiteSpace: 'pre-wrap' }}>{a.cardiopulmonaryConcerns}</p></>)}
      {a.draftNote && (<><h4>Draft note</h4><p style={{ whiteSpace: 'pre-wrap' }}>{a.draftNote}</p></>)}
      {r?.summary && (<><h4>Risk-screen reference</h4><p>{r.summary}</p></>)}
      {a.reviewerFocus && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-500)' }}>
          <strong>Reviewer focus:</strong> {a.reviewerFocus}
        </p>
      )}
    </>
  );
}
