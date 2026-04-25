'use client';

/**
 * Coordinator · Patients — facility-scoped patient list (real Athena
 * mirror data). Click a patient to see their cases (filter on the
 * board page). Detail view + chart will land in M8.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex: string | null;
  mrn: string | null;
  athenaResourceId: string | null;
  athenaLastSyncAt: string | null;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function CoordinatorPatientsPage() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200'));
        setPatients(res.items);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (!q) return true;
      return [p.firstName, p.lastName, p.mrn, p.athenaResourceId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [patients, query]);

  return (
    <AppShell breadcrumbs={['Coordinator', 'Patients']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Patients</span>
          <h1>Patients at <span className="emph">your facility</span>.</h1>
        </div>
      </div>

      <div className="toolbar">
        <div className="mini-search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search name, MRN, Athena id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} patient{rows.length === 1 ? '' : 's'}</span>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!patients ? (
        <div className="muted">Loading…</div>
      ) : patients.length === 0 ? (
        <div className="card">
          <div className="muted">
            No patients imported yet. Admins can import from the{' '}
            <Link href="/app/admin/athena" style={{ textDecoration: 'underline' }}>Athena page</Link>.
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>DOB</th>
              <th>Sex</th>
              <th>MRN</th>
              <th>Athena id</th>
              <th>Last sync</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.lastName}, {p.firstName}</td>
                <td>{ageOf(p.dob)}</td>
                <td>{p.dob}</td>
                <td>{p.sex ?? '—'}</td>
                <td>{p.mrn ?? '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.athenaResourceId ?? '—'}</td>
                <td className="muted">
                  {p.athenaLastSyncAt ? new Date(p.athenaLastSyncAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
