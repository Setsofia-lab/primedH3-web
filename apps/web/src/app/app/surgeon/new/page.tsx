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
  facilityId: string;
  firstName: string;
  lastName: string;
  dob: string;
  mrn: string | null;
  athenaResourceId: string | null;
}

interface Me {
  id: string;
  facilityId: string | null;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export default function SurgeonNewCasePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
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
        const [meRes, patRes] = await Promise.all([
          jsonOrThrow<Me>(await fetch('/api/auth/me')),
          jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
        ]);
        setMe(meRes);
        setPatients(patRes.items);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Patients at the surgeon's own facility — backend rejects cross-facility
  // assignments with a 403 'facility mismatch'. We filter client-side so the
  // dropdown only shows valid choices and never surfaces a patient that
  // would 403 on submit.
  const facilityScopedPatients = useMemo(() => {
    if (!me?.facilityId) return patients;
    return patients.filter((p) => p.facilityId === me.facilityId);
  }, [me, patients]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return facilityScopedPatients;
    return facilityScopedPatients.filter((p) =>
      [p.firstName, p.lastName, p.mrn, p.athenaResourceId, p.dob]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [search, facilityScopedPatients]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    setSubmitting(true);
    setError(null);
    try {
      const picked = patients.find((p) => p.id === patientId);
      if (!picked) throw new Error('Selected patient not found');
      const created = await jsonOrThrow<{ id: string; facilityId: string }>(
        await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            // The api re-derives facilityId from the patient row; we send
            // the patient's own facility so the request schema validates.
            facilityId: picked.facilityId,
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
        ) : facilityScopedPatients.length === 0 ? (
          <div className="muted">
            No patients are mirrored at your facility yet. Ask an admin to hydrate
            one from the Athena page, or create a demo patient under
            /app/admin/patients.
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
