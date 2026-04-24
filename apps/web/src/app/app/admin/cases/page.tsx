'use client';

/**
 * Admin · Cases — real data, replaces the Phase-1 mock.
 *
 * Lists every case in the system across all facilities. "New case"
 * picks a hydrated patient (from the Athena mirror) + a surgeon (from
 * users with role=surgeon) and stamps a `cases` row with status =
 * 'referral'. From there it flows through workup → clearance → ready
 * → completed (M7.4+).
 */
import { useEffect, useMemo, useState } from 'react';
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
  createdAt: string;
}
interface Patient {
  id: string; firstName: string; lastName: string; dob: string; mrn: string | null;
  athenaResourceId: string | null;
}
interface Facility { id: string; name: string; }
interface User {
  id: string; firstName: string; lastName: string; role: string; facilityId: string | null;
}

const STATUS_FILTERS: Array<'all' | CaseStatus> = [
  'all', 'referral', 'workup', 'clearance', 'pre_hab', 'ready', 'completed',
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export default function AdminCasesPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [surgeons, setSurgeons] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | CaseStatus>('all');

  const [open, setOpen] = useState(false);
  const [nFacility, setNFacility] = useState('');
  const [nPatient, setNPatient] = useState('');
  const [nSurgeon, setNSurgeon] = useState('');
  const [nCode, setNCode] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nDate, setNDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [c, p, f, u] = await Promise.all([
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/admin/cases?limit=200')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/admin/patients?limit=200')),
        jsonOrThrow<Facility[]>(await fetch('/api/admin/facilities')),
        jsonOrThrow<{ items: User[] }>(await fetch('/api/admin/users?role=surgeon&limit=200')),
      ]);
      setCases(c.items);
      setPatients(p.items);
      setFacilities(f);
      setSurgeons(u.items);
      if (f.length > 0 && !nFacility) setNFacility(f[0]!.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const patientById = useMemo(() => {
    const m = new Map<string, Patient>();
    patients.forEach((p) => m.set(p.id, p));
    return m;
  }, [patients]);
  const surgeonById = useMemo(() => {
    const m = new Map<string, User>();
    surgeons.forEach((u) => m.set(u.id, u));
    return m;
  }, [surgeons]);
  const facilityById = useMemo(() => {
    const m = new Map<string, Facility>();
    facilities.forEach((f) => m.set(f.id, f));
    return m;
  }, [facilities]);

  const filtered = cases?.filter((c) => filter === 'all' || c.status === filter) ?? [];

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nFacility || !nPatient) return;
    setCreating(true);
    setCreateErr(null);
    try {
      const body = {
        facilityId: nFacility,
        patientId: nPatient,
        ...(nSurgeon ? { surgeonId: nSurgeon } : {}),
        ...(nCode.trim() ? { procedureCode: nCode.trim() } : {}),
        ...(nDesc.trim() ? { procedureDescription: nDesc.trim() } : {}),
        ...(nDate ? { surgeryDate: new Date(nDate).toISOString() } : {}),
      };
      await jsonOrThrow<CaseRow>(
        await fetch('/api/admin/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      setNPatient(''); setNSurgeon(''); setNCode(''); setNDesc(''); setNDate('');
      setOpen(false);
      await load();
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell breadcrumbs={['Admin', 'Cases']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Cases</span>
          <h1>All <span className="emph">cases</span> in flight.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'New case'}
          </button>
        </div>
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><h3>New case</h3></div>
          <form onSubmit={submitCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 720 }}>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Facility</div>
              <select className="input" required value={nFacility} onChange={(e) => setNFacility(e.target.value)}>
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Patient</div>
              <select className="input" required value={nPatient} onChange={(e) => setNPatient(e.target.value)}>
                <option value="">Select…</option>
                {patients.filter((p) => !nFacility || p.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.dob}</option>
                ))}
              </select>
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Surgeon (optional)</div>
              <select className="input" value={nSurgeon} onChange={(e) => setNSurgeon(e.target.value)}>
                <option value="">—</option>
                {surgeons.map((s) => (
                  <option key={s.id} value={s.id}>Dr. {s.lastName}, {s.firstName}</option>
                ))}
              </select>
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Surgery date (optional)</div>
              <input className="input" type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Procedure code (CPT)</div>
              <input className="input" placeholder="29827" value={nCode} onChange={(e) => setNCode(e.target.value)} />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Description</div>
              <input className="input" placeholder="Arthroscopic rotator cuff repair" value={nDesc} onChange={(e) => setNDesc(e.target.value)} />
            </label>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-primary" type="submit" disabled={creating || !nPatient}>
                {creating ? 'Creating…' : 'Create case'}
              </button>
            </div>
          </form>
          {createErr && <div style={{ color: 'var(--danger, #c0392b)', marginTop: 12 }}>{createErr}</div>}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Cases {filtered.length > 0 && `(${filtered.length})`}</h3>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`btn ${filter === s ? 'btn-primary' : 'btn-outline-dark'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {error && <div style={{ color: 'var(--danger, #c0392b)' }}>{error}</div>}
        {!cases ? (
          <div className="muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="muted">
            No cases yet. Hydrate a patient on the{' '}
            <a href="/app/admin/athena" style={{ textDecoration: 'underline' }}>Athena page</a>,{' '}
            then click "New case" above.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Procedure</th>
                <th>Status</th>
                <th>Surgeon</th>
                <th>Facility</th>
                <th>Surgery date</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const p = patientById.get(c.patientId);
                const s = c.surgeonId ? surgeonById.get(c.surgeonId) : null;
                const f = facilityById.get(c.facilityId);
                return (
                  <tr key={c.id}>
                    <td>{p ? `${p.lastName}, ${p.firstName}` : c.patientId.slice(0, 8)}</td>
                    <td>{c.procedureCode ?? '—'} {c.procedureDescription ? `· ${c.procedureDescription}` : ''}</td>
                    <td><span className={`status-pill status-${c.status}`}>{c.status}</span></td>
                    <td>{s ? `Dr. ${s.lastName}` : '—'}</td>
                    <td className="muted">{f?.name ?? '—'}</td>
                    <td className="muted">{c.surgeryDate ? new Date(c.surgeryDate).toLocaleDateString() : '—'}</td>
                    <td className="muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
