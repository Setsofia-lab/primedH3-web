'use client';

/**
 * Admin · Athena integration page.
 *
 * Three panels:
 *  1. Facilities  — list + "create" row
 *  2. Hydrate     — one-shot form: (facility, athenaResourceId) → upsert
 *  3. Mirrored patients — table of what we've pulled so far
 *
 * All calls go through /api/admin/* web routes which attach the session's
 * httpOnly ph_access cookie as Bearer. The browser never touches the
 * token.
 */
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

interface Facility {
  id: string;
  name: string;
  athenaPracticeId: string | null;
  timezone: string;
}

interface Patient {
  id: string;
  facilityId: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex: string | null;
  mrn: string | null;
  athenaResourceId: string | null;
  athenaPracticeId: string | null;
  athenaLastSyncAt: string | null;
}

interface HydrateResult {
  action: 'inserted' | 'updated' | 'unchanged';
  row: Patient;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${res.status}: ${text.slice(0, 200)}`,
    );
  }
  return JSON.parse(text) as T;
}

export default function AdminAthenaPage() {
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [facError, setFacError] = useState<string | null>(null);
  const [newFacName, setNewFacName] = useState('');
  const [newFacPractice, setNewFacPractice] = useState('');
  const [creating, setCreating] = useState(false);

  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [resourceId, setResourceId] = useState('');
  const [force, setForce] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<HydrateResult | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  async function loadFacilities() {
    setFacError(null);
    try {
      const list = await jsonOrThrow<Facility[]>(await fetch('/api/admin/facilities'));
      setFacilities(list);
      if (list.length > 0 && !selectedFacility) setSelectedFacility(list[0]!.id);
    } catch (e) {
      setFacError((e as Error).message);
    }
  }

  async function loadPatients() {
    setPatientsLoading(true);
    try {
      const qs = selectedFacility ? `?facilityId=${selectedFacility}&limit=100` : '?limit=100';
      const res = await jsonOrThrow<{ items: Patient[] }>(
        await fetch(`/api/admin/patients${qs}`),
      );
      setPatients(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setPatientsLoading(false);
    }
  }

  useEffect(() => {
    void loadFacilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFacility]);

  async function createFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!newFacName.trim()) return;
    setCreating(true);
    setFacError(null);
    try {
      const body = {
        name: newFacName.trim(),
        ...(newFacPractice.trim() ? { athenaPracticeId: newFacPractice.trim() } : {}),
      };
      await jsonOrThrow<Facility>(
        await fetch('/api/admin/facilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      setNewFacName('');
      setNewFacPractice('');
      await loadFacilities();
    } catch (e) {
      setFacError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function submitHydrate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacility || !resourceId.trim()) return;
    setHydrating(true);
    setHydrateError(null);
    setLastResult(null);
    try {
      const body = {
        facilityId: selectedFacility,
        athenaResourceId: resourceId.trim(),
        ...(force ? { force: true } : {}),
      };
      const out = await jsonOrThrow<HydrateResult>(
        await fetch('/api/admin/patients/hydrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      setLastResult(out);
      await loadPatients();
    } catch (e) {
      setHydrateError((e as Error).message);
    } finally {
      setHydrating(false);
    }
  }

  return (
    <AppShell breadcrumbs={['Admin', 'Athena']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Athena integration</span>
          <h1>
            Pull patients from <span className="emph">Athena</span>.
          </h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Facilities</h3>
        </div>
        {facError && (
          <div className="muted" style={{ color: 'var(--danger, #c0392b)', marginBottom: 8 }}>
            {facError}
          </div>
        )}
        {!facilities ? (
          <div className="muted">Loading…</div>
        ) : facilities.length === 0 ? (
          <div className="muted">No facilities yet. Create one below.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Athena practice</th>
                <th>Timezone</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.athenaPracticeId ?? '—'}</td>
                  <td>{f.timezone}</td>
                  <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{f.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={createFacility} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Facility name"
            value={newFacName}
            onChange={(e) => setNewFacName(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />
          <input
            className="input"
            placeholder="Athena practice id (optional)"
            value={newFacPractice}
            onChange={(e) => setNewFacPractice(e.target.value)}
            style={{ width: 240 }}
          />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create facility'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Hydrate a patient</h3>
        </div>
        <form onSubmit={submitHydrate} style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Facility</div>
            <select
              className="input"
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
            >
              <option value="">Select a facility…</option>
              {facilities?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}{f.athenaPracticeId ? ` (practice ${f.athenaPracticeId})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Athena FHIR Patient id</div>
            <input
              className="input"
              placeholder="a-1128700.E-14914"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span className="muted">Force re-fetch (skip the 60s freshness gate)</span>
          </label>
          <div>
            <button className="btn btn-primary" type="submit" disabled={hydrating || !selectedFacility}>
              {hydrating ? 'Pulling from Athena…' : 'Hydrate'}
            </button>
          </div>
        </form>
        {hydrateError && (
          <div style={{ color: 'var(--danger, #c0392b)', marginTop: 12 }}>{hydrateError}</div>
        )}
        {lastResult && (
          <div className="muted" style={{ marginTop: 12 }}>
            <strong style={{ color: 'var(--ink-800)' }}>{lastResult.action}</strong>{' '}
            — {lastResult.row.firstName} {lastResult.row.lastName} · DOB{' '}
            {lastResult.row.dob} · MRN {lastResult.row.mrn ?? '—'}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Mirrored patients {selectedFacility && '(this facility)'}</h3>
          <button className="btn btn-outline-dark" onClick={() => void loadPatients()} disabled={patientsLoading}>
            {patientsLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {patients.length === 0 ? (
          <div className="muted">No patients mirrored yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>DOB</th>
                <th>Sex</th>
                <th>MRN</th>
                <th>Athena id</th>
                <th>Last sync</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.lastName}, {p.firstName}</td>
                  <td>{p.dob}</td>
                  <td>{p.sex ?? '—'}</td>
                  <td>{p.mrn ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.athenaResourceId ?? '—'}</td>
                  <td className="muted">{p.athenaLastSyncAt ? new Date(p.athenaLastSyncAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
