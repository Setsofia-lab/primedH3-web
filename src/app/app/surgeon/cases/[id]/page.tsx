'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { patientById, type PatientFixture } from '@/mocks/fixtures/admin';

type TabKey = 'overview' | 'hp' | 'plan' | 'workup' | 'notes';

interface WorkupTask {
  label: string;
  done: boolean;
  meta: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function daysTo(d: string) {
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000));
}

function readinessHint(r: number) {
  if (r >= 85) return 'Ready for OR — anesthesia cleared.';
  if (r >= 60) return 'Conditional — outstanding workup tasks.';
  return 'Not yet ready — multiple items open.';
}

function buildTasks(p: PatientFixture): WorkupTask[] {
  return [
    { label: 'Pre-op labs (CBC, BMP, PT/INR)', done: true, meta: 'APR 16' },
    { label: 'EKG', done: p.asa >= 2, meta: p.asa >= 2 ? 'APR 17' : 'pending' },
    { label: 'Anesthesia clearance', done: p.status === 'cleared', meta: p.status === 'cleared' ? 'APR 18' : 'in review' },
    { label: 'Cardiology consult', done: false, meta: p.asa >= 3 ? 'scheduled APR 22' : 'n/a' },
    { label: 'Patient education delivered', done: true, meta: 'APR 15' },
    { label: 'Informed consent signed', done: p.readiness > 60, meta: p.readiness > 60 ? 'APR 18' : 'pending' },
    { label: 'Pre-admission testing complete', done: p.readiness > 80, meta: p.readiness > 80 ? 'APR 19' : 'pending' },
  ];
}

function assessmentText(p: PatientFixture) {
  switch (p.status) {
    case 'cleared': return 'Cleared to proceed.';
    case 'conditional': return 'Pending anesthesia clearance conditional on BP control.';
    case 'workup': return 'Outstanding workup required prior to clearance.';
    case 'deferred': return 'Deferred pending specialist consultation.';
  }
}

export default function SurgeonCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const p = patientById(id);
  if (!p) notFound();

  const [tab, setTab] = useState<TabKey>('overview');
  const [tasks, setTasks] = useState<WorkupTask[]>(() => buildTasks(p));
  const [hpSigned, setHpSigned] = useState(false);
  const [planSigned, setPlanSigned] = useState(false);

  const doneCount = tasks.filter((t) => t.done).length;

  const toggleTask = (i: number) => {
    setTasks((arr) => arr.map((t, j) => (j === i ? { ...t, done: !t.done } : t)));
  };

  return (
    <AppShell breadcrumbs={['Surgeon', 'My cases', p.name]}>
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href="/app/surgeon"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}
        >
          ← All cases
        </Link>
      </div>

      <div className="case-hero">
        <div className="av">{p.initials}</div>
        <div>
          <h1>{p.name}</h1>
          <div className="sub">{p.age}y · {p.procedure} · CPT {p.procedureCode}</div>
        </div>
        <div className="right">
          <span className={`status-pill ${p.status}`}>{p.status}</span>
          <div className="when">
            Surgery <em>{fmtDate(p.surgeryDate)}</em>
          </div>
          <div style={{ color: '#A3ADC4', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            IN {daysTo(p.surgeryDate)} DAYS · ASA {p.asa}
          </div>
        </div>
      </div>

      <div className="tab-strip">
        <button type="button" className={tab === 'overview' ? 'active' : undefined} onClick={() => setTab('overview')}>Overview</button>
        <button type="button" className={tab === 'hp' ? 'active' : undefined} onClick={() => setTab('hp')}>H&amp;P <span className="b">AI</span></button>
        <button type="button" className={tab === 'plan' ? 'active' : undefined} onClick={() => setTab('plan')}>Plan <span className="b">AI</span></button>
        <button type="button" className={tab === 'workup' ? 'active' : undefined} onClick={() => setTab('workup')}>Workup<span className="b">{tasks.length}</span></button>
        <button type="button" className={tab === 'notes' ? 'active' : undefined} onClick={() => setTab('notes')}>Notes</button>
      </div>

      {tab === 'overview' && (
        <section className="tab-pane active">
          <div className="two-col">
            <div className="card">
              <div className="card-head"><h3>Chart summary</h3></div>
              <dl className="kv-list">
                <dt>MRN</dt><dd>{p.id.replace('pt_', 'mrn_').toUpperCase()}</dd>
                <dt>Age · Sex</dt><dd>{p.age} · —</dd>
                <dt>Procedure</dt><dd>{p.procedure}</dd>
                <dt>CPT</dt><dd><code>{p.procedureCode}</code></dd>
                <dt>Surgeon</dt><dd>{p.surgeon}</dd>
                <dt>Surgery date</dt><dd>{fmtDate(p.surgeryDate)}</dd>
                <dt>ASA class</dt><dd>ASA {p.asa}</dd>
                <dt>Conditions</dt><dd>{p.conditions.join(' · ')}</dd>
                <dt>Medications</dt><dd>{p.medications.join(' · ')}</dd>
              </dl>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Readiness</h3></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontFeatureSettings: '"ss01","cv11"',
                      fontSize: '2.25rem',
                      fontWeight: 400,
                      color: 'var(--ink-900)',
                      lineHeight: 1,
                    }}
                  >
                    {p.readiness}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="readiness-bar">
                      <div className="track">
                        <div className="fill" style={{ width: `${p.readiness}%` }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: '0.375rem' }}>
                      {readinessHint(p.readiness)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Agent activity</h3></div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0' }}>
                    <span className="agent-tag">IntakeOrch</span> Drafted H&amp;P · 2h ago
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0' }}>
                    <span className="agent-tag">RiskScreen</span> ASA {p.asa} · RCRI 1 · STOP-BANG 3
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0' }}>
                    <span className="agent-tag">Comms</span> Sent pre-op nudge · 4h ago
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'hp' && (
        <section className="tab-pane active">
          <div className="ai-draft">
            <div className="dh">
              <span>AI-DRAFTED · REVIEW BEFORE SIGNING</span>
              <span className="sp" />
              <span className="agent">by IntakeOrchestrator · v12</span>
            </div>
            <div className="db">
              <h4>History of present illness</h4>
              <p>
                {p.name} is a {p.age}-year-old presenting for{' '}
                <b>{p.procedure.toLowerCase()}</b>. {p.conditions[0]}. No acute decompensation.
              </p>
              <h4>Past medical history</h4>
              <ul>{p.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
              <h4>Medications</h4>
              <ul>{p.medications.map((m) => <li key={m}>{m}</li>)}</ul>
              <h4>Physical exam</h4>
              <p>
                Vitals within normal limits. Cardiovascular: regular rate and rhythm. Pulmonary: clear to
                auscultation bilaterally. Abdomen: <em>soft, non-tender</em>. No acute findings.
              </p>
              <h4>Assessment</h4>
              <p>
                Patient is an ASA {p.asa} surgical candidate for {p.procedure.toLowerCase()}. {assessmentText(p)}
              </p>
            </div>
            <div className="df">
              <span className="cite">Guidelines: ACC/AHA 2024 · NSQIP 2023</span>
              <span className="spacer" />
              <button className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Edit draft</button>
              <button
                className="btn btn-primary"
                style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', background: hpSigned ? 'var(--success)' : undefined }}
                onClick={() => setHpSigned(true)}
                disabled={hpSigned}
              >
                {hpSigned ? 'Signed ✓' : 'Sign H\u0026P'}
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === 'plan' && (
        <section className="tab-pane active">
          <div className="ai-draft">
            <div className="dh">
              <span>AI-DRAFTED · REVIEW BEFORE SIGNING</span>
              <span className="sp" />
              <span className="agent">by IntakeOrchestrator · v12</span>
            </div>
            <div className="db">
              <h4>Procedure plan</h4>
              <p>
                <b>{p.procedure}</b> (CPT <code>{p.procedureCode}</code>). Estimated OR time: 90 minutes.
                Outpatient unless complications.
              </p>
              <h4>Pre-op workup</h4>
              <ul>
                <li>CBC, BMP, PT/INR within 30 days</li>
                <li>EKG for patients ≥ 50 or with cardiac history</li>
                <li>Anesthesia clearance (risk class {p.asa})</li>
                {p.asa >= 3 && <li>Cardiology consult (CAD history)</li>}
              </ul>
              <h4>Intra-op</h4>
              <ul>
                <li>General anesthesia with LMA</li>
                <li>Cefazolin 2g prior to incision</li>
                <li>DVT prophylaxis per NSQIP</li>
              </ul>
              <h4>Post-op</h4>
              <ul>
                <li>PACU recovery, discharge home same day if stable</li>
                <li>Follow-up clinic visit in 1–2 weeks</li>
                <li>Patient-directed education delivered via PrimedHealth app</li>
              </ul>
            </div>
            <div className="df">
              <span className="cite">NSQIP risk calculator · CPT-aligned</span>
              <span className="spacer" />
              <button className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Edit draft</button>
              <button
                className="btn btn-primary"
                style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', background: planSigned ? 'var(--success)' : undefined }}
                onClick={() => setPlanSigned(true)}
                disabled={planSigned}
              >
                {planSigned ? 'Approved ✓' : 'Approve plan'}
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === 'workup' && (
        <section className="tab-pane active">
          <div className="card">
            <div className="card-head">
              <h3>Workup tasks</h3>
              <span className="status-pill neutral">{doneCount} of {tasks.length} complete</span>
            </div>
            <div>
              {tasks.map((t, i) => (
                <div className={`task-row${t.done ? ' done' : ''}`} key={t.label} onClick={() => toggleTask(i)} style={{ cursor: 'pointer' }}>
                  <div className="cb" />
                  <div className="lbl">{t.label}</div>
                  <div className="meta">{t.meta.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'notes' && (
        <section className="tab-pane active">
          <div className="card">
            <div className="card-head">
              <h3>Clinical notes</h3>
              <button className="btn btn-primary" style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}>Add note</button>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.55 }}>
              <div style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--ink-500)', marginBottom: '0.25rem' }}>
                  APR 18 · DR. ODUYA
                </div>
                Discussed laparoscopic approach with patient. Reviewed risks including bleeding, infection,
                bile duct injury. Patient expressed understanding and consented. Plan to proceed once
                anesthesia clears HTN management.
              </div>
              <div style={{ padding: '0.75rem 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--ink-500)', marginBottom: '0.25rem' }}>
                  APR 15 · PRIYA OKAFOR, RN
                </div>
                Patient completed pre-op education module. Transport and post-op care arrangements
                confirmed with daughter.
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="sign-off-bar">
        <div className="lbl">
          Ready to <b>sign off</b> on this case? H&amp;P and plan are drafted and awaiting your review.
        </div>
        <button className="btn btn-ghost-dark">Defer</button>
        <button className="btn btn-primary">Sign &amp; send to anesthesia</button>
      </div>
    </AppShell>
  );
}
