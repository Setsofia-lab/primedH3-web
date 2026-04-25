'use client';

/**
 * Admin · Case detail.
 *
 * Read + edit a single case, styled to match the surgeon mockup. The
 * "Edit" pane writes via PATCH /api/admin/cases/[id]; status changes
 * land via the same endpoint. Future tabs (H&P, Plan, Workup) light up
 * once M9 ships agents that produce those drafts.
 */
import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { AppShell } from '@/components/shell/AppShell';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

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
interface User {
  id: string; firstName: string; lastName: string; role: string;
}

const STATUSES: CaseStatus[] = [
  'referral', 'workup', 'clearance', 'pre_hab', 'ready', 'completed', 'cancelled',
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

function ageOf(dob: string): number {
  const d = new Date(dob);
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
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

export default function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CaseRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [surgeon, setSurgeon] = useState<User | null>(null);
  const [allSurgeons, setAllSurgeons] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // Edit-form state, hydrated from server data
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
      // Hydrate edit form from the live row
      setEStatus(caseRow.status);
      setESurgeonId(caseRow.surgeonId ?? '');
      setECode(caseRow.procedureCode ?? '');
      setEDesc(caseRow.procedureDescription ?? '');
      setEDate(fmtDateInput(caseRow.surgeryDate));
      setEReadiness(caseRow.readinessScore == null ? '' : String(caseRow.readinessScore));

      // Side-load patient + surgeon list (cheap; ~few hundred rows max).
      const [allP, allU] = await Promise.all([
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/admin/patients?limit=200')),
        jsonOrThrow<{ items: User[] }>(await fetch('/api/admin/users?role=surgeon&limit=200')),
      ]);
      setPatient(allP.items.find((p) => p.id === caseRow.patientId) ?? null);
      setAllSurgeons(allU.items);
      setSurgeon(caseRow.surgeonId ? allU.items.find((u) => u.id === caseRow.surgeonId) ?? null : null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  async function save() {
    if (!c) return;
    setSaving(true);
    setSaveOk(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        status: eStatus,
        surgeonId: eSurgeonId || null,
        procedureCode: eCode.trim() || null,
        procedureDescription: eDesc.trim() || null,
        surgeryDate: eDate ? new Date(eDate).toISOString() : null,
        readinessScore:
          eReadiness === '' ? null : Math.max(0, Math.min(100, Number(eReadiness))),
      };
      const updated = await jsonOrThrow<CaseRow>(
        await fetch(`/api/admin/cases/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      setC(updated);
      setSaveOk('Saved.');
      // Refresh surgeon if it changed
      setSurgeon(updated.surgeonId ? allSurgeons.find((u) => u.id === updated.surgeonId) ?? null : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!c && !error) {
    return (
      <AppShell breadcrumbs={['Admin', 'Cases', 'Loading…']}>
        <div className="muted">Loading…</div>
      </AppShell>
    );
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
        <Link
          href="/app/admin/cases"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}
        >
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
          <div className="when">
            Surgery <em>{c.surgeryDate ? fmtDate(c.surgeryDate) : 'unscheduled'}</em>
          </div>
          {days != null && (
            <div style={{ color: '#A3ADC4', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              IN {days} DAYS
            </div>
          )}
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="card-head"><h3>Chart summary</h3></div>
          <dl className="kv-list">
            <dt>Patient</dt><dd>{patientName}</dd>
            <dt>DOB</dt><dd>{patient?.dob ?? '—'}</dd>
            <dt>Sex</dt><dd>{patient?.sex ?? '—'}</dd>
            <dt>MRN</dt><dd>{patient?.mrn ?? '—'}</dd>
            <dt>Athena id</dt>
            <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {patient?.athenaResourceId ?? '—'}
            </dd>
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
                <div className="readiness-bar">
                  <div className="track">
                    <div className="fill" style={{ width: `${c.readinessScore ?? 0}%` }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: '0.375rem' }}>
                  {c.readinessScore == null ? 'Not yet scored — agents land in M9.' : c.readinessScore >= 85 ? 'Ready for OR.' : c.readinessScore >= 60 ? 'Conditional — outstanding workup.' : 'Not ready — multiple items open.'}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Edit</h3></div>
            <div style={{ display: 'grid', gap: 10 }}>
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
                <div className="muted" style={{ marginBottom: 4 }}>CPT</div>
                <input className="input" value={eCode} onChange={(e) => setECode(e.target.value)} />
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Description</div>
                <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Readiness (0–100)</div>
                <input className="input" inputMode="numeric" value={eReadiness} onChange={(e) => setEReadiness(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {saveOk && <span className="muted">{saveOk}</span>}
                {error && <span style={{ color: 'var(--danger, #c0392b)' }}>{error}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
