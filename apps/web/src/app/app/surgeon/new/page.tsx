'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

const STEPS = [
  { n: 1, label: 'Procedure', state: 'done' as const },
  { n: 2, label: 'Patient', state: 'active' as const },
  { n: 3, label: 'AI workup plan', state: 'todo' as const },
  { n: 4, label: 'Confirm', state: 'todo' as const },
];

export default function SurgeonNewCasePage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const onConfirm = async () => {
    setConfirming(true);
    await new Promise((r) => setTimeout(r, 500));
    router.push('/app/surgeon');
  };

  return (
    <AppShell breadcrumbs={['Surgeon', 'New case']}>
      <style>{`
        .stepper { display:flex; gap:0.5rem; margin-bottom:1.5rem; }
        .stepper .s { flex:1; padding:0.75rem 1rem; background:var(--surface-0); border:1px solid var(--border); border-radius:var(--radius-md); font-size:0.8125rem; color:var(--ink-500); display:flex; align-items:center; gap:0.5rem; }
        .stepper .s .n { width:22px; height:22px; border-radius:50%; background:var(--surface-100); color:var(--ink-500); display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:0.75rem; }
        .stepper .s.active { border-color:var(--primary-blue); background:var(--primary-blue-50); color:var(--primary-blue); }
        .stepper .s.active .n { background:var(--primary-blue); color:#fff; }
        .stepper .s.done { color:var(--ink-900); }
        .stepper .s.done .n { background:var(--success); color:#fff; }
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
        {STEPS.map((s) => (
          <div key={s.n} className={`s${s.state === 'active' ? ' active' : ''}${s.state === 'done' ? ' done' : ''}`}>
            <span className="n">{s.n}</span> {s.label}
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h3>Patient details</h3></div>
          <div className="field-grid">
            <div className="field"><label>First name</label><input type="text" defaultValue="Jordan" /></div>
            <div className="field"><label>Last name</label><input type="text" defaultValue="Park" /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label>DOB</label><input type="text" defaultValue="1964-03-12" /></div>
            <div className="field"><label>MRN</label><input type="text" defaultValue="MRN_JORDAN_PARK" /></div>
          </div>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Procedure (CPT)</label>
            <input type="text" defaultValue="27447 · Total knee arthroplasty" />
          </div>
          <div className="field-grid">
            <div className="field"><label>Target surgery date</label><input type="date" defaultValue="2026-05-02" /></div>
            <div className="field">
              <label>Priority</label>
              <select defaultValue="Routine">
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
              defaultValue="Severe OA bilateral knees. Failed conservative management including PT, injections, and NSAIDs over 18 months."
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ai-draft">
            <div className="dh">
              <span>AI-DRAFTED WORKUP</span>
              <span className="sp" />
              <span className="agent">by IntakeOrchestrator</span>
            </div>
            <div className="db">
              <h4>Risk screening</h4>
              <p>BMI 29.1 · OA bilateral · presumed ASA 2. RCRI: low risk. Functional capacity: estimated 4+ METs.</p>
              <h4>Required workup</h4>
              <ul>
                <li>Pre-op labs: CBC, BMP, PT/INR within 30 days</li>
                <li>EKG (age ≥ 50)</li>
                <li>Anesthesia clearance</li>
                <li>Patient education · TKA module</li>
              </ul>
              <h4>Suggested specialists</h4>
              <ul><li>Primary care med-eval · 1 slot within 10d</li></ul>
              <h4>Estimated readiness by surgery date</h4>
              <p><b>92%</b> — on track if workup initiated in next 3 days.</p>
            </div>
            <div className="df">
              <span className="cite">ACC/AHA 2024 · NSQIP</span>
              <span className="spacer" />
              <button className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Regenerate</button>
            </div>
          </div>

          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                color: 'var(--ink-500)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '0.375rem',
              }}
            >
              What happens next
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.5 }}>
              On confirm, the <b>IntakeOrchestrator</b> opens the case, the{' '}
              <b>TaskTrackerAgent</b> routes it to the coordinator board, and the{' '}
              <b>PatientCommsAgent</b> drafts the welcome SMS — all awaiting your team&apos;s
              review.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <Link className="btn btn-ghost" href="/app/surgeon">Cancel</Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline-dark">Save draft</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Creating…' : 'Continue →'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
