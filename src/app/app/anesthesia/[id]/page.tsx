'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { patientById, type PatientFixture } from '@/mocks/fixtures/admin';

type Decision = null | 'cleared' | 'conditional' | 'deferred';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function daysTo(d: string) {
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000));
}

function rcriFor(p: PatientFixture) { return p.asa >= 3 ? 2 : 1; }
function stopBangFor(p: PatientFixture) { return p.asa >= 3 ? 5 : p.asa >= 2 ? 3 : 1; }
function airwayFor(p: PatientFixture) {
  return p.asa >= 3 ? 'Mallampati III · high-risk airway' : 'Mallampati II · reassuring';
}

function disposition(p: PatientFixture) {
  switch (p.status) {
    case 'cleared': return 'Cleared to proceed. Proceed with general anesthesia per service standard.';
    case 'conditional': return 'Conditional clearance pending BP optimization. Recommend continuing antihypertensives through morning of surgery.';
    case 'workup': return 'Pre-op workup outstanding — see task list. Clearance deferred pending results.';
    case 'deferred': return 'Defer. CAD history with untreated OSA — cardiology consult and sleep study required prior to elective surgery.';
  }
}

const DECISION_LABEL: Record<Exclude<Decision, null>, string> = {
  cleared: 'Cleared',
  conditional: 'Conditional',
  deferred: 'Deferred',
};

export default function AnesthesiaClearancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const p = patientById(id);
  if (!p) notFound();

  const [decision, setDecision] = useState<Decision>(null);

  const rcri = rcriFor(p);
  const stopBang = stopBangFor(p);
  const airway = airwayFor(p);

  const noMedAdjust = p.medications.length === 1 && p.medications[0] === 'None';

  return (
    <AppShell breadcrumbs={['Anesthesia', 'Queue', p.name]}>
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href="/app/anesthesia"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)', textDecoration: 'none' }}
        >
          ← Queue
        </Link>
      </div>

      <div className="case-hero">
        <div className="av">{p.initials}</div>
        <div>
          <h1>{p.name}</h1>
          <div className="sub">{p.age}y · {p.procedure} · ASA {p.asa}</div>
        </div>
        <div className="right">
          <span className={`status-pill ${p.status}`}>{p.status}</span>
          <div className="when">Surgery <em>{fmt(p.surgeryDate)}</em></div>
          <div style={{ color: '#A3ADC4', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            IN {daysTo(p.surgeryDate)} DAYS
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="ai-draft">
            <div className="dh">
              <span>AI-DRAFTED PRE-ANESTHESIA NOTE</span>
              <span className="sp" />
              <span className="agent">by AnesthesiaClearance · v14</span>
            </div>
            <div className="db">
              <h4>Airway</h4>
              <p>{airway}. BMI estimated from chart. Neck range of motion preserved.</p>
              <h4>Cardiac</h4>
              <p>
                RCRI <b>{rcri}</b> ·{' '}
                {rcri >= 2
                  ? 'Elevated perioperative cardiac risk (>1%).'
                  : 'Low perioperative cardiac risk (<1%).'}{' '}
                Functional capacity estimated {p.asa >= 3 ? '<' : '≥'}4 METs.
              </p>
              <h4>Pulmonary</h4>
              <p>
                STOP-BANG <b>{stopBang}</b>/8 ·{' '}
                {stopBang >= 5
                  ? 'High OSA risk — consider CPAP post-op.'
                  : stopBang >= 3
                    ? 'Intermediate OSA risk.'
                    : 'Low OSA risk.'}
              </p>
              <h4>Recommendations</h4>
              <ul>
                <li>{noMedAdjust ? 'No medication adjustments required.' : 'Continue antihypertensives morning of surgery.'}</li>
                <li>Labs (CBC, BMP) within 30 days of surgery.</li>
                {rcri >= 2 && <li>Continue beta-blocker; monitor intraop.</li>}
                {stopBang >= 5 && <li>Post-op continuous pulse oximetry.</li>}
              </ul>
              <h4>Disposition</h4>
              <p><em>{disposition(p)}</em></p>
            </div>
            <div className="df">
              <span className="cite">ACC/AHA 2024 · ASA Practice Guidelines · STOP-BANG</span>
              <span className="spacer" />
              <button className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Edit draft</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Risk scores</h3></div>
            <dl className="kv-list">
              <dt>ASA</dt><dd>Class {p.asa}</dd>
              <dt>RCRI</dt><dd>{rcri} of 6</dd>
              <dt>STOP-BANG</dt><dd>{stopBang} of 8</dd>
              <dt>Readiness</dt><dd>{p.readiness}%</dd>
            </dl>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Conditions</h3></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {p.conditions.map((c) => (
                <span
                  key={c}
                  className="chip"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    background: 'var(--surface-100)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--ink-700)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '0.5rem' }}><h3>Medications</h3></div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.55 }}>
              {p.medications.map((m) => (
                <div key={m} style={{ padding: '0.25rem 0' }}>· {m}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sign-off-bar">
        <div className="lbl">
          <b>Ready to decide?</b> Your clearance routes immediately to the coordinator board and
          surgeon inbox.
        </div>
        <button
          className="btn btn-ghost-dark"
          onClick={() => setDecision('deferred')}
          disabled={decision !== null}
        >
          Defer
        </button>
        <button
          className="btn btn-ghost-dark"
          onClick={() => setDecision('conditional')}
          disabled={decision !== null}
        >
          Conditional
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setDecision('cleared')}
          disabled={decision !== null}
          style={decision ? { background: 'var(--success)' } : undefined}
        >
          {decision ? `${DECISION_LABEL[decision]} ✓` : 'Clear for surgery'}
        </button>
      </div>
    </AppShell>
  );
}
