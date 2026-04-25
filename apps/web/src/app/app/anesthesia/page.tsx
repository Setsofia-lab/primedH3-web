'use client';

/**
 * Anesthesia · Queue — cases needing anesthesia review (workup +
 * clearance status, scoped to the user's facility by the api).
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
}
interface Patient { id: string; firstName: string; lastName: string; dob: string; }
interface Provider { id: string; firstName: string; lastName: string; role: string; }

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

export default function AnesthesiaQueuePage() {
  const me = useCurrentUser();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [providers, setProviders] = useState<Map<string, Provider>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        // Default scope already filters to workup+clearance for anesthesia role.
        const [c, p, pr] = await Promise.all([
          jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
          jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
          jsonOrThrow<{ items: Provider[] }>(await fetch('/api/providers')),
        ]);
        setCases(c.items);
        const pm = new Map<string, Patient>();
        p.items.forEach((x) => pm.set(x.id, x));
        setPatients(pm);
        const prm = new Map<string, Provider>();
        pr.items.forEach((x) => prm.set(x.id, x));
        setProviders(prm);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  return (
    <AppShell breadcrumbs={['Anesthesia', 'Queue']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            Anesthesia{me ? ` · ${me.firstName} ${me.lastName}` : ''}
          </span>
          <h1>Clearance <span className="emph">queue</span>.</h1>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!cases ? (
        <div className="muted">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="card"><div className="muted">Queue is empty. Nothing waiting on anesthesia review.</div></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Procedure</th>
              <th>Surgeon</th>
              <th>Surgery</th>
              <th>Status</th>
              <th>Readiness</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const p = patients.get(c.patientId);
              const s = c.surgeonId ? providers.get(c.surgeonId) : null;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="row-with-avatar">
                      <span className="avatar-xs">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                      <div>
                        <div className="cell-primary">{p ? `${p.firstName} ${p.lastName}` : c.patientId.slice(0, 8)}</div>
                        <div className="cell-sub">{p ? `age ${ageOf(p.dob)}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="cell-primary">{c.procedureDescription ?? '—'}</div>
                    <div className="cell-sub">{c.procedureCode ? `CPT ${c.procedureCode}` : ''}</div>
                  </td>
                  <td>{s ? `Dr. ${s.lastName}` : <span className="muted">unassigned</span>}</td>
                  <td>
                    {c.surgeryDate ? (
                      <>
                        {fmtDate(c.surgeryDate)}
                        <div className="cell-sub">in {daysTo(c.surgeryDate)} days</div>
                      </>
                    ) : <span className="muted">unscheduled</span>}
                  </td>
                  <td><span className={`status-pill ${c.status}`}>{c.status}</span></td>
                  <td>
                    {c.readinessScore != null ? (
                      <div className="readiness-bar">
                        <div className="track">
                          <div className="fill" style={{ width: `${c.readinessScore}%` }} />
                        </div>
                        <div className="val">{c.readinessScore}</div>
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/app/anesthesia/cleared" style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12, textDecoration: 'none' }}>
          → Cleared
        </Link>
        {'  '}
        <Link href="/app/anesthesia/deferred" style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12, textDecoration: 'none' }}>
          → Deferred
        </Link>
      </div>
    </AppShell>
  );
}
