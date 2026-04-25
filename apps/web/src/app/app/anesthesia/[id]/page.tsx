'use client';

/**
 * Anesthesia · case detail — real data, read-only for the anesthesia
 * role. Decision actions (clear / conditional / defer) land in M8 once
 * we have an audit trail; for now this view shows the case + chart
 * summary.
 */
import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { TasksPanel } from '@/components/tasks/TasksPanel';

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
}
interface Patient {
  id: string; firstName: string; lastName: string; dob: string; sex: string | null;
  mrn: string | null; athenaResourceId: string | null;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export default function AnesthesiaCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CaseRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const caseRow = await jsonOrThrow<CaseRow>(await fetch(`/api/cases/${id}`));
        setC(caseRow);
        const p = await jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200'));
        setPatient(p.items.find((x) => x.id === caseRow.patientId) ?? null);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  if (!c && !error) return <AppShell breadcrumbs={['Anesthesia', 'Loading…']}><div className="muted">Loading…</div></AppShell>;
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
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <TasksPanel caseId={c.id} canCreate />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head"><h3>Pre-anesthesia summary</h3></div>
        <dl className="kv-list">
          <dt>Patient</dt><dd>{patientName}</dd>
          <dt>DOB</dt><dd>{patient?.dob ?? '—'}</dd>
          <dt>Sex</dt><dd>{patient?.sex ?? '—'}</dd>
          <dt>MRN</dt><dd>{patient?.mrn ?? '—'}</dd>
          <dt>Procedure</dt><dd>{c.procedureDescription ?? '—'}</dd>
          <dt>CPT</dt><dd>{c.procedureCode ? <code>{c.procedureCode}</code> : '—'}</dd>
          <dt>Readiness</dt><dd>{c.readinessScore ?? '—'}</dd>
        </dl>
        <div className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Clearance / conditional / defer actions land with the audit-trail
          work in M8. For now status mutations happen on the admin side.
        </div>
      </div>
    </AppShell>
  );
}
