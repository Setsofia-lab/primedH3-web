'use client';

/**
 * Surgeon · My cases — real, scoped to current user.
 *
 * The api's GET /cases returns only the cases where surgeon_id = me.id
 * (see CasesController.scopeFor). No client-side filtering needed.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';
import { useCurrentUser } from '@/lib/auth/use-current-user';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

interface CaseRow {
  id: string;
  patientId: string;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  readinessScore: number | null;
  surgeryDate: string | null;
  createdAt: string;
}
interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  athenaResourceId: string | null;
  mrn: string | null;
}

const STATUS_FILTERS: Array<{ s: 'all' | CaseStatus; label: string }> = [
  { s: 'all',        label: 'All' },
  { s: 'referral',   label: 'Referral' },
  { s: 'workup',     label: 'Workup' },
  { s: 'clearance',  label: 'Clearance' },
  { s: 'ready',      label: 'Ready' },
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function daysTo(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export default function SurgeonCasesPage() {
  const me = useCurrentUser();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [query, setQuery] = useState('');

  async function load() {
    setError(null);
    try {
      const [c, p] = await Promise.all([
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=100')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
      ]);
      setCases(c.items);
      const m = new Map<string, Patient>();
      p.items.forEach((x) => m.set(x.id, x));
      setPatients(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    if (!cases) return [];
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!q) return true;
      const p = patients.get(c.patientId);
      const text = [
        p?.firstName, p?.lastName, p?.mrn, c.procedureCode, c.procedureDescription,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [cases, status, query, patients]);

  return (
    <AppShell breadcrumbs={['Surgeon', 'My cases']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            Surgeon{me ? ` · Dr. ${me.lastName}` : ''}
          </span>
          <h1>My <span className="emph">cases</span>.</h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline-dark" href="/app/surgeon/schedule">Schedule</Link>
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.s}
              type="button"
              className={status === f.s ? 'active' : undefined}
              onClick={() => setStatus(f.s)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mini-search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search patient, procedure"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} case{rows.length === 1 ? '' : 's'}</span>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!cases ? (
        <div className="muted">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="muted">
            No cases assigned to you yet. An admin needs to create a case and assign you as the
            surgeon (see <Link href="/app/admin/cases" style={{ textDecoration: 'underline' }}>admin · cases</Link>).
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Procedure</th>
              <th>Surgery</th>
              <th>Readiness</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const p = patients.get(c.patientId);
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }}
                    onClick={() => { window.location.href = `/app/surgeon/cases/${c.id}`; }}>
                  <td>
                    <div className="row-with-avatar">
                      <span className="avatar-xs">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                      <div>
                        <div className="cell-primary">{p ? `${p.firstName} ${p.lastName}` : c.patientId.slice(0, 8)}</div>
                        <div className="cell-sub">
                          {p ? `${p.athenaResourceId ?? p.mrn ?? ''} · age ${ageOf(p.dob)}` : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="cell-primary">{c.procedureDescription ?? '—'}</div>
                    <div className="cell-sub">{c.procedureCode ? `CPT ${c.procedureCode}` : ''}</div>
                  </td>
                  <td>
                    {c.surgeryDate ? (
                      <>
                        {fmtDate(c.surgeryDate)}
                        <div className="cell-sub">in {daysTo(c.surgeryDate)} days</div>
                      </>
                    ) : (
                      <span className="muted">unscheduled</span>
                    )}
                  </td>
                  <td>
                    {c.readinessScore != null ? (
                      <div className="readiness-bar">
                        <div className="track">
                          <div className="fill" style={{ width: `${c.readinessScore}%` }} />
                        </div>
                        <div className="val">{c.readinessScore}</div>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td><span className={`status-pill ${c.status}`}>{c.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
