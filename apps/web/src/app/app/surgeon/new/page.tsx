'use client';

/**
 * Surgeon · New case — Phase-1 wizard restored.
 *
 *   stepper                    Procedure ✓ · Patient · AI workup plan · Confirm
 *   two-col                    [ Patient details form ] [ AI-drafted workup ]
 *   sign-off bar               Cancel / Save draft / Continue
 *
 * The visual mirrors the original Phase-1 reference (extracted from
 * the static prototype). The form posts to /api/cases — auto-assigns
 * surgeonId = caller, status defaults to 'referral'. On success we
 * route to the surgeon case-detail cockpit which then fans the
 * IntakeOrchestrator → RiskScreening → ReadinessAgent → PatientComms
 * agents.
 *
 * Patient picker is filtered to the surgeon's own facility — the
 * backend rejects cross-facility cases with a 403, so we never
 * surface a patient that would fail at submit time.
 */
import Link from 'next/link';
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

function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

type StepState = 'done' | 'active' | 'todo';

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
  const [priority, setPriority] = useState<'Routine' | 'Urgent' | 'Semi-urgent'>('Routine');
  const [notes, setNotes] = useState('');
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

  // Backend will 403 cross-facility writes. Filter the picker so the
  // surgeon never sees a patient at another site.
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

  const picked = patients.find((p) => p.id === patientId) ?? null;

  // The 4-step narrative is visual: it tracks how complete the form
  // is so the user can see what's left before they hit Continue.
  const steps: { n: number; label: string; state: StepState }[] = useMemo(() => {
    const procedureDone = code.trim().length > 0 || desc.trim().length > 0;
    const patientDone = Boolean(patientId);
    const planDone = Boolean(date);
    return [
      { n: 1, label: 'Procedure', state: procedureDone ? 'done' : 'active' },
      {
        n: 2,
        label: 'Patient',
        state: patientDone ? 'done' : procedureDone ? 'active' : 'todo',
      },
      {
        n: 3,
        label: 'AI workup plan',
        state: planDone ? 'done' : patientDone ? 'active' : 'todo',
      },
      { n: 4, label: 'Confirm', state: planDone ? 'active' : 'todo' },
    ];
  }, [patientId, code, desc, date]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await jsonOrThrow<{ id: string }>(
        await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            facilityId: picked.facilityId,
            ...(code.trim() ? { procedureCode: code.trim() } : {}),
            ...(desc.trim() ? { procedureDescription: desc.trim() } : {}),
            ...(date ? { surgeryDate: new Date(date).toISOString() } : {}),
          }),
        }),
      );
      router.push(`/app/surgeon/cases/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // The AI-drafted workup card on the right is intentionally a
  // narrative/template — the real IntakeOrchestrator only fires
  // *after* the case is created. We show what's about to happen.
  const aiAge = picked ? ageOf(picked.dob) : null;
  const aiName = picked ? `${picked.firstName} ${picked.lastName}` : null;

  return (
    <AppShell breadcrumbs={['Surgeon', 'New case']}>
      <style jsx>{`
        .stepper { display:flex; gap:0.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
        .stepper .s { flex:1; min-width:140px; padding:0.75rem 1rem; background:var(--surface-0); border:1px solid var(--border); border-radius:var(--radius-md); font-size:0.8125rem; color:var(--ink-500); display:flex; align-items:center; gap:0.5rem; }
        .stepper .s .n { width:22px; height:22px; border-radius:50%; background:var(--surface-100); color:var(--ink-500); display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:0.75rem; flex-shrink:0; }
        .stepper .s.active { border-color:var(--primary-blue); background:var(--primary-blue-50, #eef1ff); color:var(--primary-blue); }
        .stepper .s.active .n { background:var(--primary-blue); color:#fff; }
        .stepper .s.done { color:var(--ink-900); }
        .stepper .s.done .n { background:var(--success, #16a34a); color:#fff; }
        .two-col { display:grid; grid-template-columns: minmax(0,1.05fr) minmax(0,0.95fr); gap:1.25rem; }
        @media (max-width: 980px) { .two-col { grid-template-columns: 1fr; } }
        .field-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem; }
        .field { display:flex; flex-direction:column; gap:0.25rem; }
        .field label { font-family:var(--font-mono); font-size:0.6875rem; color:var(--ink-500); letter-spacing:0.06em; text-transform:uppercase; }
        .field input, .field select, .field textarea { width:100%; border:1px solid var(--border); border-radius:var(--radius-sm,6px); padding:0.5rem 0.625rem; background:#fff; font:inherit; color:var(--ink-900); }
        .field textarea { resize:vertical; }
        .ai-draft { background:var(--surface-0); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; }
        .ai-draft .dh { display:flex; align-items:center; gap:0.5rem; padding:0.625rem 1rem; background:var(--primary-blue-50, #eef1ff); border-bottom:1px solid var(--border); font-family:var(--font-mono); font-size:0.6875rem; letter-spacing:0.08em; color:var(--primary-blue); text-transform:uppercase; }
        .ai-draft .dh .sp { flex:1; }
        .ai-draft .dh .agent { color:var(--ink-700); text-transform:none; letter-spacing:0; font-family:var(--font-sans, inherit); font-size:0.75rem; }
        .ai-draft .db { padding:1rem 1.25rem; font-size:0.875rem; color:var(--ink-700); line-height:1.55; }
        .ai-draft .db h4 { margin:0.875rem 0 0.375rem; font-size:0.8125rem; color:var(--ink-900); font-family:var(--font-display, inherit); font-weight:600; }
        .ai-draft .db h4:first-child { margin-top:0; }
        .ai-draft .db p { margin:0 0 0.5rem; }
        .ai-draft .db ul { margin:0 0 0.5rem; padding-left:1.125rem; }
        .ai-draft .db ul li { margin-bottom:0.25rem; }
        .ai-draft .df { display:flex; align-items:center; padding:0.625rem 1rem; background:var(--surface-50, #fafafa); border-top:1px solid var(--border); }
        .ai-draft .df .cite { font-family:var(--font-mono); font-size:0.6875rem; color:var(--ink-500); letter-spacing:0.04em; }
        .ai-draft .df .spacer { flex:1; }
        .what-next { padding:1rem 1.25rem; }
        .what-next .lbl { font-family:var(--font-mono); font-size:0.6875rem; color:var(--ink-500); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.375rem; }
        .what-next .body { font-size:0.875rem; color:var(--ink-700); line-height:1.5; }
        .mini-search-wrap { position:relative; margin-bottom:0.5rem; }
      `}</style>

      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · New case</span>
          <h1>
            Open a <span className="emph">case</span>.
          </h1>
        </div>
      </div>

      <div className="stepper">
        {steps.map((s) => (
          <div
            key={s.n}
            className={`s${s.state === 'active' ? ' active' : ''}${s.state === 'done' ? ' done' : ''}`}
          >
            <span className="n">{s.state === 'done' ? '✓' : s.n}</span> {s.label}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', margin: '0 0 12px' }}>{error}</div>
      )}

      <form onSubmit={onSubmit}>
        <div className="two-col">
          {/* LEFT — patient details */}
          <div className="card">
            <div className="card-head"><h3>Patient details</h3></div>

            {loading ? (
              <div className="muted">Loading patients…</div>
            ) : facilityScopedPatients.length === 0 ? (
              <div className="muted">
                No patients are mirrored at your facility yet. Ask an admin to
                hydrate one from the{' '}
                <Link
                  href="/app/admin/athena"
                  style={{ textDecoration: 'underline' }}
                >
                  Athena page
                </Link>
                , or invite a patient on the admin Users page.
              </div>
            ) : (
              <>
                <div className="mini-search mini-search-wrap">
                  <Icon name="search" size={14} />
                  <input
                    type="text"
                    placeholder="Search patient by name, MRN, DOB"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="field" style={{ marginBottom: '0.75rem' }}>
                  <label>Patient *</label>
                  <select
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {filteredPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.lastName}, {p.firstName} · DOB {p.dob}
                        {p.mrn ? ` · MRN ${p.mrn}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {picked && (
                  <div className="field-grid">
                    <div className="field">
                      <label>First name</label>
                      <input type="text" value={picked.firstName} readOnly />
                    </div>
                    <div className="field">
                      <label>Last name</label>
                      <input type="text" value={picked.lastName} readOnly />
                    </div>
                  </div>
                )}
                {picked && (
                  <div className="field-grid">
                    <div className="field">
                      <label>DOB</label>
                      <input type="text" value={picked.dob} readOnly />
                    </div>
                    <div className="field">
                      <label>MRN</label>
                      <input
                        type="text"
                        value={picked.mrn ?? picked.athenaResourceId ?? ''}
                        readOnly
                      />
                    </div>
                  </div>
                )}

                <div className="field" style={{ marginBottom: '0.75rem' }}>
                  <label>Procedure (CPT)</label>
                  <input
                    type="text"
                    placeholder="27447 · Total knee arthroplasty"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: '0.75rem' }}>
                  <label>Procedure description</label>
                  <input
                    type="text"
                    placeholder="Arthroscopic rotator cuff repair"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label>Target surgery date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Priority</label>
                    <select
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as typeof priority)
                      }
                    >
                      <option>Routine</option>
                      <option>Urgent</option>
                      <option>Semi-urgent</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Clinical notes</label>
                  <textarea
                    rows={4}
                    placeholder="Indication, prior treatment, comorbidities…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* RIGHT — AI-drafted workup + what happens next */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ai-draft">
              <div className="dh">
                <span>AI-DRAFTED WORKUP</span>
                <span className="sp" />
                <span className="agent">by IntakeOrchestrator</span>
              </div>
              <div className="db">
                <h4>Risk screening</h4>
                <p>
                  {aiName ? `${aiName}, age ${aiAge}. ` : ''}
                  Presumed ASA based on age + comorbidities. RCRI: low risk
                  (refined after labs). Functional capacity: estimated 4+ METs.
                </p>
                <h4>Required workup</h4>
                <ul>
                  <li>Pre-op labs: CBC, BMP, PT/INR within 30 days</li>
                  {aiAge != null && aiAge >= 50 && <li>EKG (age ≥ 50)</li>}
                  <li>Anesthesia clearance</li>
                  <li>Patient education · procedure module</li>
                </ul>
                <h4>Suggested specialists</h4>
                <ul>
                  <li>Primary care med-eval · 1 slot within 10d</li>
                </ul>
                <h4>Estimated readiness by surgery date</h4>
                <p>
                  <b>—</b> · IntakeOrchestrator + ReadinessAgent compute the
                  real score on case open.
                </p>
              </div>
              <div className="df">
                <span className="cite">ACC/AHA 2024 · NSQIP</span>
                <span className="spacer" />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  disabled
                  title="Available after the case is opened"
                >
                  Regenerate
                </button>
              </div>
            </div>

            <div className="card what-next" style={{ padding: 0 }}>
              <div className="what-next">
                <div className="lbl">What happens next</div>
                <div className="body">
                  On confirm, the <b>IntakeOrchestrator</b> opens the case, the{' '}
                  <b>RiskScreeningAgent</b> + <b>ReadinessAgent</b> compute the
                  initial readiness score, and the <b>PatientCommsAgent</b>{' '}
                  drafts the welcome SMS — all awaiting your team&apos;s review
                  in the case cockpit.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.5rem',
          }}
        >
          <Link className="btn btn-ghost" href="/app/surgeon">
            Cancel
          </Link>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-outline-dark" disabled>
              Save draft
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !patientId}
            >
              {submitting ? 'Opening case…' : 'Continue →'}
            </button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
