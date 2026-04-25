'use client';

/**
 * Surgeon · case detail — real data, read-only for the surgeon.
 *
 * The api enforces visibility (surgeon_id == me) so a surgeon can't
 * load someone else's case here. All mutation lives on the admin
 * side for now; once M9 brings agents online we'll add surgeon-driven
 * actions (sign clearance, request consult, etc.).
 */
import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { AppShell } from '@/components/shell/AppShell';

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
  createdAt: string;
  updatedAt: string;
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
function daysTo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export default function SurgeonCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CaseRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const caseRow = await jsonOrThrow<CaseRow>(await fetch(`/api/cases/${id}`));
        setC(caseRow);
        // Fetch the patient via the facility-scoped /patients endpoint.
        const p = await jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200'));
        setPatient(p.items.find((x) => x.id === caseRow.patientId) ?? null);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

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

      <div className="two-col" style={{ marginTop: 24 }}>
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
                  {c.readinessScore == null ? 'Not yet scored — agents land in M9.'
                    : c.readinessScore >= 85 ? 'Ready for OR.'
                    : c.readinessScore >= 60 ? 'Conditional — outstanding workup.'
                    : 'Not ready — multiple items open.'}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Agent activity</h3></div>
            <div className="muted" style={{ fontSize: 13 }}>
              Once the worker (M9) ships, this will stream IntakeOrchestrator,
              RiskScreening, AnesthesiaClearance, etc. activity for this case.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
