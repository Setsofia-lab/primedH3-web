'use client';

/**
 * Admin · Cases — real data, mockup-faithful design.
 *
 * Top toolbar with status filter pills + a mini-search; data-table with
 * patient/procedure/surgeon/surgery/readiness/status. Click a row → go
 * to /app/admin/cases/[id] for the detail+edit view.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

interface CaseRow {
  id: string;
  facilityId: string;
  patientId: string;
  surgeonId: string | null;
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
  id: string; firstName: string; lastName: string; role: string;
}

const STATUS_FILTERS: Array<{ s: 'all' | CaseStatus; label: string }> = [
  { s: 'all',        label: 'All' },
  { s: 'referral',   label: 'Referral' },
  { s: 'workup',     label: 'Workup' },
  { s: 'clearance',  label: 'Clearance' },
  { s: 'pre_hab',    label: 'Pre-hab' },
  { s: 'ready',      label: 'Ready' },
  { s: 'completed',  label: 'Completed' },
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

function ageOf(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
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

export default function AdminCasesPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [surgeons, setSurgeons] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [query, setQuery] = useState('');

  // Inline new-case form state
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

  const rows = useMemo(() => {
    if (!cases) return [];
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!q) return true;
      const p = patientById.get(c.patientId);
      const haystack = [
        p?.firstName,
        p?.lastName,
        p?.mrn,
        c.procedureCode,
        c.procedureDescription,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cases, status, query, patientById]);

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
          <h1>All active <span className="emph">cases</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
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
                {patients.map((p) => (
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
            placeholder="Search patient, procedure, MRN"
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
        <div className="card">
          <div className="muted">
            No cases yet. Hydrate a patient on the{' '}
            <Link href="/app/admin/athena" style={{ textDecoration: 'underline' }}>Athena page</Link>,{' '}
            then click "New case" above.
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Procedure</th>
              <th>Surgeon</th>
              <th>Surgery</th>
              <th>Readiness</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const p = patientById.get(c.patientId);
              const s = c.surgeonId ? surgeonById.get(c.surgeonId) : null;
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/app/admin/cases/${c.id}`; }}>
                  <td>
                    <div className="row-with-avatar">
                      <span className="avatar-xs">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                      <div>
                        <div className="cell-primary">
                          {p ? `${p.firstName} ${p.lastName}` : c.patientId.slice(0, 8)}
                        </div>
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
                  <td>{s ? `Dr. ${s.lastName}` : <span className="muted">unassigned</span>}</td>
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
