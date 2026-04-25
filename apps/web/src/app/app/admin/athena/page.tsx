'use client';

/**
 * Admin · Athena — facility management + live FHIR Patient search +
 * one-click hydration.
 *
 * Workflow:
 *   1. (One-time) create a Facility with the Athena practice id.
 *   2. Search Athena by name (or family + given/birthdate/gender) — the
 *      api forwards to FHIR R4 with the facility's practice and returns
 *      candidate Patients alongside which ones we already mirror.
 *   3. Click "Import" on a candidate → POST /admin/patients/hydrate →
 *      row appears in the mirror table below.
 *
 * No more pasting raw Athena ids; the surgeon-friendly path is search
 * → preview → click.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

interface Facility {
  id: string;
  name: string;
  athenaPracticeId: string | null;
  timezone: string;
}

interface MirrorPatient {
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

interface FhirHumanName {
  family?: string;
  given?: string[];
  text?: string;
  use?: string;
}
interface FhirPatient {
  id: string;
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: string;
  identifier?: { system?: string; value?: string; use?: string }[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 250)}`);
  return JSON.parse(text) as T;
}

function pickName(fhir: FhirPatient): { first: string; last: string } {
  const n = fhir.name?.find((x) => x.use === 'official') ?? fhir.name?.[0];
  return {
    first: n?.given?.[0] ?? '',
    last: n?.family ?? '',
  };
}

function pickMrn(fhir: FhirPatient): string {
  // MR-coded identifier first, then use=usual, then first present.
  const id = fhir.identifier?.find((i) => i.use === 'usual') ?? fhir.identifier?.[0];
  return id?.value ?? '';
}

export default function AdminAthenaPage() {
  // Facilities
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [facError, setFacError] = useState<string | null>(null);
  const [newFacName, setNewFacName] = useState('');
  const [newFacPractice, setNewFacPractice] = useState('');
  const [creating, setCreating] = useState(false);

  // Selected facility (drives search practiceId + mirror filter)
  const [selectedFacility, setSelectedFacility] = useState<string>('');

  // Search
  const [sFamily, setSFamily] = useState('');
  const [sGiven, setSGiven] = useState('');
  const [sDob, setSDob] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FhirPatient[] | null>(null);
  const [alreadyMirrored, setAlreadyMirrored] = useState<Record<string, string>>({});

  // Hydrate
  const [hydratingId, setHydratingId] = useState<string | null>(null);
  const [hydrateErr, setHydrateErr] = useState<string | null>(null);

  // Mirror table
  const [mirror, setMirror] = useState<MirrorPatient[]>([]);
  const [mirrorLoading, setMirrorLoading] = useState(false);

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

  async function loadMirror() {
    if (!selectedFacility) return;
    setMirrorLoading(true);
    try {
      const res = await jsonOrThrow<{ items: MirrorPatient[] }>(
        await fetch(`/api/admin/patients?facilityId=${selectedFacility}&limit=200`),
      );
      setMirror(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setMirrorLoading(false);
    }
  }

  useEffect(() => { void loadFacilities(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (selectedFacility) void loadMirror();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFacility]);

  const selectedFacilityRow = useMemo(
    () => facilities?.find((f) => f.id === selectedFacility) ?? null,
    [facilities, selectedFacility],
  );

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
      setNewFacName(''); setNewFacPractice('');
      await loadFacilities();
    } catch (e) {
      setFacError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityRow?.athenaPracticeId) {
      setSearchErr('Select a facility with an Athena practice id first.');
      return;
    }
    setSearching(true);
    setSearchErr(null);
    setSearchResults(null);
    try {
      const params = new URLSearchParams({ practiceId: selectedFacilityRow.athenaPracticeId });
      // Athena accepts these combos: [name], [family,given], [family,birthdate], [family,gender].
      if (sFamily && sGiven) {
        params.set('family', sFamily); params.set('given', sGiven);
      } else if (sFamily && sDob) {
        params.set('family', sFamily); params.set('birthdate', sDob);
      } else if (sFamily) {
        // Single-name search — Athena requires `name=` for a single-arg search.
        params.set('name', sFamily);
      } else {
        throw new Error('Enter at least a family name (last name).');
      }
      const out = await jsonOrThrow<{ items: FhirPatient[]; alreadyMirrored: Record<string, string> }>(
        await fetch(`/api/admin/patients/search?${params.toString()}`),
      );
      setSearchResults(out.items);
      setAlreadyMirrored(out.alreadyMirrored);
    } catch (e) {
      setSearchErr((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function hydrate(athenaResourceId: string) {
    if (!selectedFacility) return;
    setHydratingId(athenaResourceId);
    setHydrateErr(null);
    try {
      await jsonOrThrow(
        await fetch('/api/admin/patients/hydrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId: selectedFacility,
            athenaResourceId,
          }),
        }),
      );
      await loadMirror();
      // Mark as mirrored locally so the button updates
      setAlreadyMirrored((m) => ({ ...m, [athenaResourceId]: athenaResourceId }));
    } catch (e) {
      setHydrateErr((e as Error).message);
    } finally {
      setHydratingId(null);
    }
  }

  return (
    <AppShell breadcrumbs={['Admin', 'Athena']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Athena integration</span>
          <h1>Search and import <span className="emph">patients</span>.</h1>
        </div>
      </div>

      {/* --- Facility picker + create --- */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Facility</h3>
        </div>
        {facError && <div style={{ color: 'var(--danger, #c0392b)', marginBottom: 8 }}>{facError}</div>}
        {!facilities ? (
          <div className="muted">Loading…</div>
        ) : facilities.length === 0 ? (
          <div className="muted">No facilities yet. Create one below.</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <select className="input" value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} style={{ flex: 1 }}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}{f.athenaPracticeId ? ` (practice ${f.athenaPracticeId})` : ' (no Athena practice)'}
                </option>
              ))}
            </select>
            <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {selectedFacilityRow?.timezone ?? ''}
            </span>
          </div>
        )}
        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>+ Add facility</summary>
          <form onSubmit={createFacility} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Facility name" value={newFacName} onChange={(e) => setNewFacName(e.target.value)} style={{ flex: '1 1 240px' }} />
            <input className="input" placeholder="Athena practice id (e.g. 1128700)" value={newFacPractice} onChange={(e) => setNewFacPractice(e.target.value)} style={{ width: 240 }} />
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        </details>
      </div>

      {/* --- Athena search --- */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Search Athena</h3>
          {selectedFacilityRow?.athenaPracticeId && (
            <span className="status-pill neutral">practice {selectedFacilityRow.athenaPracticeId}</span>
          )}
        </div>
        <form onSubmit={search} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.4fr auto', gap: 8, alignItems: 'end' }}>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Last name (required)</div>
            <input className="input" placeholder="Rivera" value={sFamily} onChange={(e) => setSFamily(e.target.value)} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>First name (optional)</div>
            <input className="input" placeholder="Mark" value={sGiven} onChange={(e) => setSGiven(e.target.value)} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Birthdate (optional)</div>
            <input className="input" type="date" value={sDob} onChange={(e) => setSDob(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={searching || !selectedFacilityRow?.athenaPracticeId}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchErr && <div style={{ color: 'var(--danger, #c0392b)', marginTop: 12 }}>{searchErr}</div>}
        {hydrateErr && <div style={{ color: 'var(--danger, #c0392b)', marginTop: 12 }}>{hydrateErr}</div>}

        {searchResults && (
          searchResults.length === 0 ? (
            <div className="muted" style={{ marginTop: 12 }}>
              No matches in Athena Preview. Try just the last name, or check the practice id.
            </div>
          ) : (
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>DOB</th>
                  <th>Sex</th>
                  <th>MRN / Identifier</th>
                  <th>Athena id</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((p) => {
                  const { first, last } = pickName(p);
                  const mirroredId = alreadyMirrored[p.id];
                  const isHydrating = hydratingId === p.id;
                  return (
                    <tr key={p.id}>
                      <td>{last}, {first}</td>
                      <td>{p.birthDate ?? '—'}</td>
                      <td>{p.gender ?? '—'}</td>
                      <td>{pickMrn(p) || <span className="muted">—</span>}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.id}</td>
                      <td>
                        {mirroredId ? (
                          <span className="status-pill neutral">imported</span>
                        ) : (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            disabled={isHydrating}
                            onClick={() => void hydrate(p.id)}
                          >
                            {isHydrating ? 'Importing…' : 'Import'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* --- Mirror table --- */}
      <div className="card">
        <div className="card-head">
          <h3>Imported patients</h3>
          <button className="btn btn-outline-dark" onClick={() => void loadMirror()} disabled={mirrorLoading}>
            {mirrorLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {mirror.length === 0 ? (
          <div className="muted">No imports yet for this facility. Search above and click "Import".</div>
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
              {mirror.map((p) => (
                <tr key={p.id}>
                  <td>{p.lastName}, {p.firstName}</td>
                  <td>{p.dob}</td>
                  <td>{p.sex ?? '—'}</td>
                  <td>{p.mrn ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.athenaResourceId ?? '—'}</td>
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
