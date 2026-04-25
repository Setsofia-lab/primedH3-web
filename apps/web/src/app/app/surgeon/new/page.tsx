'use client';

/**
 * Surgeon · New case — surgeon-driven creation. Pick a patient at the
 * facility, set procedure + date, post. The api auto-assigns
 * surgeonId = caller. Status defaults to 'referral'.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  mrn: string | null;
  athenaResourceId: string | null;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export default function SurgeonNewCasePage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await jsonOrThrow<{ items: Patient[] }>(
          await fetch('/api/patients?limit=200'),
        );
        setPatients(r.items);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) =>
      [p.firstName, p.lastName, p.mrn, p.athenaResourceId, p.dob]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [search, patients]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await jsonOrThrow<{ id: string; facilityId: string }>(
        await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            // facilityId is ignored for non-admins server-side, but the
            // schema requires it. The api re-derives it from the patient.
            facilityId: patients.find((p) => p.id === patientId)?.id, // placeholder
            ...(code.trim() ? { procedureCode: code.trim() } : {}),
            ...(desc.trim() ? { procedureDescription: desc.trim() } : {}),
            ...(date ? { surgeryDate: new Date(date).toISOString() } : {}),
          }),
        }),
      );
      router.push(`/app/surgeon/cases/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell breadcrumbs={['Surgeon', 'New case']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · New case</span>
          <h1>Open a <span className="emph">new case</span>.</h1>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      <div className="card" style={{ maxWidth: 720 }}>
        {loading ? (
          <div className="muted">Loading patients…</div>
        ) : patients.length === 0 ? (
          <div className="muted">
            No patients have been imported yet at your facility. Ask an admin
            to hydrate one from the Athena page first.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Search patients</div>
              <div className="mini-search" style={{ marginBottom: 8 }}>
                <Icon name="search" size={14} />
                <input
                  type="text"
                  placeholder="name, MRN, DOB"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>

            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Patient *</div>
              <select className="input" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Select…</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName} · DOB {p.dob}{p.mrn ? ` · MRN ${p.mrn}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>CPT code</div>
                <input className="input" placeholder="29827" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label>
                <div className="muted" style={{ marginBottom: 4 }}>Procedure</div>
                <input className="input" placeholder="Arthroscopic rotator cuff repair" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </label>
            </div>

            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Surgery date (optional — set later if not yet scheduled)</div>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <div>
              <button className="btn btn-primary" type="submit" disabled={submitting || !patientId}>
                {submitting ? 'Opening case…' : 'Open case'}
              </button>
              <span className="muted" style={{ marginLeft: 12, fontSize: 12 }}>
                You'll be auto-assigned as the surgeon. Status starts at "referral".
              </span>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
