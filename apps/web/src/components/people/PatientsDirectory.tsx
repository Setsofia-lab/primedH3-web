'use client';

/**
 * Shared "My patients" directory used by /app/admin/patients and
 * /app/coordinator/patients. The two routes are required to render
 * pixel-identical UI (the only difference is the breadcrumbs +
 * eyebrow line above the H1).
 *
 * The view is case-centric: one row per active case, joined to the
 * patient + surgeon. We pull live data from:
 *
 *   /api/cases?limit=200      role-scoped on the api side. Admin sees
 *                             everything in the facility; coordinator
 *                             sees facility-scoped cases.
 *   /api/patients?limit=200   facility-scoped patient mirror.
 *   /api/providers            facility-scoped provider directory used
 *                             to label the "surgeon" column.
 *
 * Cancelled / completed cases are filtered out (matches the Phase-1
 * "active queue" behaviour of the original mock).
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

interface CaseRow {
  id: string;
  patientId: string;
  surgeonId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: string;
  readinessScore: number | null;
  surgeryDate: string | null;
}
interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  athenaResourceId: string | null;
  /** ASA class is not on every patient row in our schema yet; the
   *  Phase-1 fixture computed it on the fly. We surface the field
   *  when it exists and fall back to "—" otherwise. */
  asaClass?: number | null;
}
interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied';
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function initials(first: string, last: string): string {
  const f = (first || '').trim()[0] ?? '';
  const l = (last || '').trim()[0] ?? '';
  return (f + l || '?').toUpperCase();
}

function fmtSurgeryDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Map case.status onto the readiness/phase pill colours from globals.css. */
function phasePillClass(status: string): string {
  switch (status) {
    case 'pre_op':
      return 'completed';
    case 'workup':
    case 'clearance':
      return 'deferred';
    case 'cancelled':
    case 'completed':
      return 'cancelled';
    case 'surgery':
      return 'completed';
    case 'referral':
    case 'intake':
    default:
      return 'deferred';
  }
}

/** Human-readable phase label matching the Phase-1 design tokens. */
function phaseLabel(status: string): string {
  switch (status) {
    case 'pre_op':
      return 'pre-op';
    case 'workup':
      return 'workup';
    case 'clearance':
      return 'clearance';
    case 'cancelled':
      return 'cancelled';
    case 'completed':
      return 'completed';
    case 'surgery':
      return 'surgery';
    case 'referral':
      return 'referral';
    case 'intake':
      return 'intake';
    default:
      return status;
  }
}

export interface PatientsDirectoryProps {
  /** Crumbs for the AppShell topbar — e.g. ['Admin', 'Patients']. */
  breadcrumbs: string[];
  /** Eyebrow line above the H1, e.g. 'Coordinator · Patients'. */
  eyebrow: string;
  /** Where each row should link. The case detail route differs per role. */
  caseHref: (caseId: string) => string;
}

export function PatientsDirectory({ breadcrumbs, eyebrow, caseHref }: PatientsDirectoryProps) {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [c, p, pr] = await Promise.all([
          jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
          jsonOrNull<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
          jsonOrNull<{ items: Provider[] }>(await fetch('/api/providers')),
        ]);
        setCases(c?.items ?? []);
        setPatients(p?.items ?? []);
        setProviders(pr?.items ?? []);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const patientById = useMemo(() => {
    const m = new Map<string, Patient>();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  const providerById = useMemo(() => {
    const m = new Map<string, Provider>();
    for (const p of providers) m.set(p.id, p);
    return m;
  }, [providers]);

  const rows = useMemo(() => {
    if (!cases) return [];
    // Active cases first, sorted by surgery date asc (nulls last).
    return cases
      .filter((c) => c.status !== 'cancelled' && c.status !== 'completed')
      .map((c) => ({
        c,
        patient: patientById.get(c.patientId) ?? null,
        surgeon: c.surgeonId ? providerById.get(c.surgeonId) ?? null : null,
      }))
      .sort((a, b) => {
        const ta = a.c.surgeryDate ? new Date(a.c.surgeryDate).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.c.surgeryDate ? new Date(b.c.surgeryDate).getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
  }, [cases, patientById, providerById]);

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>
            My <span className="emph">patients</span>.
          </h1>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>
      )}

      {!cases ? (
        <div className="muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="muted">
            No active cases for your facility yet. Open a case from the Surgeon
            workspace to populate this list.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="patients-table">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Patient</th>
                <th>Procedure</th>
                <th style={{ width: 140 }}>Surgeon</th>
                <th style={{ width: 220 }}>Readiness</th>
                <th style={{ width: 120 }}>Phase</th>
                <th style={{ width: 100 }}>Surgery</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, patient, surgeon }) => {
                const score = c.readinessScore ?? 0;
                const proc = c.procedureDescription ?? c.procedureCode ?? '—';
                const name = patient
                  ? `${patient.firstName} ${patient.lastName}`
                  : '—';
                const sub = patient
                  ? `${ageOf(patient.dob)}y${
                      patient.asaClass ? ` · ASA ${patient.asaClass}` : ''
                    }`
                  : '';
                const surgeonLabel = surgeon
                  ? `Dr. ${surgeon.lastName}`
                  : '—';
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={caseHref(c.id)} className="patient-cell">
                        <span className="avatar-circle">
                          {patient ? initials(patient.firstName, patient.lastName) : '??'}
                        </span>
                        <span>
                          <div className="nm">{name}</div>
                          {sub && <div className="sub">{sub}</div>}
                        </span>
                      </Link>
                    </td>
                    <td>{proc}</td>
                    <td>{surgeonLabel}</td>
                    <td>
                      <div className="readiness-cell">
                        <div className="readiness-bar">
                          <div
                            className="fill"
                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                          />
                        </div>
                        <span className="readiness-pct">{score}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${phasePillClass(c.status)}`}>
                        {phaseLabel(c.status)}
                      </span>
                    </td>
                    <td>{fmtSurgeryDate(c.surgeryDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .patients-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .patients-table thead th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-500);
          border-bottom: 1px solid var(--border);
          font-weight: 500;
        }
        .patients-table tbody td {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--ink-900);
        }
        .patients-table tbody tr:last-child td {
          border-bottom: none;
        }
        .patient-cell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: inherit;
          text-decoration: none;
        }
        .patient-cell:hover .nm {
          text-decoration: underline;
        }
        .avatar-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--primary-blue);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
        }
        .nm {
          font-weight: 600;
          color: var(--ink-900);
        }
        .sub {
          font-size: 0.75rem;
          color: var(--ink-500);
          margin-top: 2px;
        }
        .readiness-cell {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .readiness-bar {
          flex: 1;
          height: 6px;
          background: var(--surface-100);
          border-radius: 3px;
          overflow: hidden;
        }
        .readiness-bar .fill {
          height: 100%;
          background: var(--primary-blue);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .readiness-pct {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--ink-700);
          min-width: 38px;
          text-align: right;
        }
      `}</style>
    </AppShell>
  );
}
