'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSessionStore } from '@/store/session';

type FacilityType = 'hospital' | 'ambulatory' | 'multispecialty' | 'academic';
type StepNum = 1 | 2 | 3 | 4 | 5;

const FACILITY_TYPES: Array<{ v: FacilityType; nm: string; ds: string }> = [
  { v: 'hospital', nm: 'Hospital / health system', ds: 'Multi-specialty, inpatient + outpatient surgery' },
  { v: 'ambulatory', nm: 'Ambulatory surgery center', ds: 'Day-surgery · clinic-based pre-op' },
  { v: 'multispecialty', nm: 'Multi-specialty group', ds: 'Independent surgeons, shared coordinators' },
  { v: 'academic', nm: 'Academic medical center', ds: 'Teaching · residents + attending workflow' },
];

interface Invite {
  id: number;
  email: string;
  role: string;
}

const ROLE_OPTS = ['Surgeon', 'Anesthesiologist', 'Care coordinator', 'Allied clinician', 'Admin'];

const READY_AGENTS = [
  '01 IntakeOrchestrator',
  '02 AnesthesiaClearance',
  '03 DocumentationAgent',
  '04 ReferralAgent',
  '05 PatientCommsAgent',
  '06 ReadinessAgent',
  '07 PreHabAgent',
  '08 TaskTrackerAgent',
  '09 RiskScreeningAgent',
];

const SteppedNav = ({ step }: { step: StepNum }) => (
  <div className="onb-steps">
    {[
      { n: 1, t: 'Facility info', d: 'Name, NPI, service lines' },
      { n: 2, t: 'EHR connection', d: 'Athena Sandbox · practiceID' },
      { n: 3, t: 'Invite team', d: 'Surgeons, anesthesia, coordinators' },
      { n: 4, t: 'Go live', d: 'Review and flip the switch' },
    ].map((s) => {
      const cls = step === 5 ? 'done' : s.n < step ? 'done' : s.n === step ? 'current' : '';
      return (
        <div key={s.n} className={`onb-step ${cls}`.trim()}>
          <span className="num">{s.n}</span>
          <div>
            <div className="t">{s.t}</div>
            <div className="d">{s.d}</div>
          </div>
        </div>
      );
    })}
  </div>
);

export default function OnboardingPage() {
  const router = useRouter();
  const setOnboarded = useSessionStore((s) => s.setOnboarded);
  const setSession = useSessionStore((s) => s.setSession);

  const [step, setStep] = useState<StepNum>(1);
  const [facilityName, setFacilityName] = useState('Pacific Coast Surgery Center');
  const [npi, setNpi] = useState('1407889502');
  const [stateName, setStateName] = useState('California');
  const [facilityType, setFacilityType] = useState<FacilityType>('hospital');
  const [practiceId, setPracticeId] = useState('1128700');
  const [environment, setEnvironment] = useState('Preview sandbox (api.preview.platform.athenahealth.com)');
  const [invites, setInvites] = useState<Invite[]>([
    { id: 1, email: 'marcus.oduya@pacificcoast.org', role: 'Surgeon' },
    { id: 2, email: 'saira.chen@pacificcoast.org', role: 'Anesthesiologist' },
    { id: 3, email: 'priya.okafor@pacificcoast.org', role: 'Care coordinator' },
  ]);
  const [provisioning, setProvisioning] = useState(false);

  const progress = useMemo(() => Math.min(100, (step / 4) * 100), [step]);

  const goStep = (n: StepNum) => {
    setStep(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addInvite = () => {
    setInvites((arr) => [...arr, { id: Date.now(), email: '', role: 'Care coordinator' }]);
  };
  const removeInvite = (id: number) => {
    if (invites.length <= 1) return;
    setInvites((arr) => arr.filter((i) => i.id !== id));
  };
  const updateInvite = (id: number, patch: Partial<Invite>) => {
    setInvites((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const goLive = async () => {
    setProvisioning(true);
    setOnboarded(true);
    setSession('admin');
    await new Promise((r) => setTimeout(r, 1200));
    setStep(5);
    await new Promise((r) => setTimeout(r, 1800));
    router.push('/app/admin');
  };

  const facilityTypeLabel =
    FACILITY_TYPES.find((f) => f.v === facilityType)?.nm ?? 'Hospital / health system';

  return (
    <div className="onb-shell">
      <aside className="onb-side">
        <Link className="onb-logo" href="/">
          <span className="dot" /> PrimedHealth
        </Link>

        <div className="onb-intro">
          <div className="lbl">Facility onboarding</div>
          <h2>
            Turn on your <span className="emph">agents</span> in four steps.
          </h2>
          <p>
            We&apos;ll spin up your facility, connect Athena, invite your team, and hand you a live
            admin cockpit.
          </p>
        </div>

        <SteppedNav step={step} />

        <div className="onb-foot">{'// HIPAA-aligned · sandbox · no real PHI'}</div>
      </aside>

      <main className="onb-main">
        <div className="progress-bar">
          <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <section className="onb-step-pane anim-up">
            <span className="step-label">Step 1 of 4</span>
            <h1>
              Tell us about your <span className="emph">facility</span>.
            </h1>
            <p className="lead">
              You can change any of this later. We use this to wire the sidebar, route agents, and
              brand the patient surface.
            </p>

            <div className="onb-field">
              <label htmlFor="fac-name">Facility name</label>
              <input
                className="input"
                id="fac-name"
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="onb-field">
                <label htmlFor="fac-npi">NPI</label>
                <input
                  className="input"
                  id="fac-npi"
                  type="text"
                  value={npi}
                  onChange={(e) => setNpi(e.target.value)}
                />
              </div>
              <div className="onb-field">
                <label htmlFor="fac-state">State</label>
                <select
                  className="select"
                  id="fac-state"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                >
                  <option>California</option>
                  <option>New York</option>
                  <option>Texas</option>
                  <option>Florida</option>
                  <option>Washington</option>
                </select>
              </div>
            </div>

            <div className="onb-field">
              <label>Facility type</label>
              <div className="facility-types">
                {FACILITY_TYPES.map((ft) => (
                  <button
                    key={ft.v}
                    type="button"
                    className={`ft-card${ft.v === facilityType ? ' active' : ''}`}
                    onClick={() => setFacilityType(ft.v)}
                    aria-pressed={ft.v === facilityType}
                  >
                    <div className="hd">
                      <span className="nm">{ft.nm}</span>
                      <span className="rd" />
                    </div>
                    <span className="ds">{ft.ds}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="onb-nav-row">
              <Link className="btn btn-ghost" href="/role">
                ← Back to roles
              </Link>
              <div className="right">
                <button className="btn btn-primary" onClick={() => goStep(2)}>
                  Continue →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <section className="onb-step-pane anim-up">
            <span className="step-label">Step 2 of 4</span>
            <h1>
              Connect your <span className="emph">EHR</span>.
            </h1>
            <p className="lead">
              PrimedHealth is Athena-first for MVP. Point us at a sandbox practice; we&apos;ll run
              everything against fake patients until you flip to production.
            </p>

            <div className="ehr-card">
              <div className="ehr-logo">a</div>
              <div className="ehr-body">
                <div className="t">athenahealth</div>
                <div className="d">
                  Patient · Appointments · Chart · Encounter · Documents · Event Notifications
                </div>
                <span className="chk">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  CONNECTED · SANDBOX
                </span>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: '1.25rem' }}>
              <div className="onb-field">
                <label htmlFor="practice-id">Practice ID</label>
                <input
                  className="input"
                  id="practice-id"
                  type="text"
                  value={practiceId}
                  onChange={(e) => setPracticeId(e.target.value)}
                />
                <span className="hint">
                  Sandbox hospital practice. Use 195900 for ambulatory, 80000 for patient PHR app.
                </span>
              </div>
              <div className="onb-field">
                <label htmlFor="env">Environment</label>
                <select
                  className="select"
                  id="env"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <option>Preview sandbox (api.preview.platform.athenahealth.com)</option>
                  <option>Production (requires BAA + credentials)</option>
                </select>
              </div>
            </div>

            <div className="onb-field">
              <label>Event subscriptions</label>
              <div className="agent-ready-list" style={{ marginTop: '0.375rem' }}>
                {['Appointment created', 'Chart document added', 'Encounter closed', 'Lab result posted'].map(
                  (e) => (
                    <div className="ar-item" key={e}>
                      <div className="lt">
                        <span>{e}</span>
                      </div>
                      <span className="ck">ON</span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="onb-nav-row">
              <button className="btn btn-ghost" onClick={() => goStep(1)}>
                ← Back
              </button>
              <div className="right">
                <button className="btn btn-primary" onClick={() => goStep(3)}>
                  Continue →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <section className="onb-step-pane anim-up">
            <span className="step-label">Step 3 of 4</span>
            <h1>
              Invite your <span className="emph">team</span>.
            </h1>
            <p className="lead">
              Each invite gets a magic-link email. Roles map to app surfaces — you can reassign at
              any time.
            </p>

            <div className="onb-field">
              <label>Team invites</label>
              <div>
                {invites.map((inv) => (
                  <div className="invite-row" key={inv.id}>
                    <input
                      className="input"
                      type="email"
                      placeholder="name@facility.org"
                      value={inv.email}
                      onChange={(e) => updateInvite(inv.id, { email: e.target.value })}
                    />
                    <select
                      className="select"
                      value={inv.role}
                      onChange={(e) => updateInvite(inv.id, { role: e.target.value })}
                    >
                      {ROLE_OPTS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="icon-btn-inline"
                      aria-label="Remove"
                      onClick={() => removeInvite(inv.id)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="add-invite" onClick={addInvite}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add another
              </button>
            </div>

            <div className="onb-nav-row">
              <button className="btn btn-ghost" onClick={() => goStep(2)}>
                ← Back
              </button>
              <div className="right">
                <button className="btn btn-outline" onClick={() => goStep(4)}>
                  Skip for now
                </button>
                <button className="btn btn-primary" onClick={() => goStep(4)}>
                  Send invites →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <section className="onb-step-pane anim-up">
            <span className="step-label">Step 4 of 4</span>
            <h1>
              Review and <span className="emph">go live</span>.
            </h1>
            <p className="lead">
              Flip the switch and your admin cockpit starts streaming. Agents are ready to run.
            </p>

            <div className="summary-card">
              <div className="summary-row">
                <span className="lbl">FACILITY</span>
                <span className="val">{facilityName || 'Pacific Coast Surgery Center'}</span>
              </div>
              <div className="summary-row">
                <span className="lbl">NPI</span>
                <span className="val">{npi || '—'}</span>
              </div>
              <div className="summary-row">
                <span className="lbl">TYPE</span>
                <span className="val">{facilityTypeLabel}</span>
              </div>
              <div className="summary-row">
                <span className="lbl">EHR</span>
                <span className="val">Athena Sandbox · practiceID {practiceId}</span>
              </div>
              <div className="summary-row">
                <span className="lbl">INVITES</span>
                <span className="val">{invites.length} team members</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                  color: 'var(--ink-500)',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Agents ready to run
              </label>
              <div className="agent-ready-list">
                {READY_AGENTS.map((label) => {
                  const [num, ...rest] = label.split(' ');
                  return (
                    <div className="ar-item" key={label}>
                      <div className="lt">
                        <span className="num">{num}</span>
                        <span className="nm">{rest.join(' ')}</span>
                      </div>
                      <span className="ck">✓</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="onb-nav-row">
              <button className="btn btn-ghost" onClick={() => goStep(3)}>
                ← Back
              </button>
              <div className="right">
                <button
                  className="btn btn-primary"
                  onClick={goLive}
                  aria-disabled={provisioning}
                  disabled={provisioning}
                >
                  {provisioning ? 'Provisioning…' : 'Go live →'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SUCCESS */}
        {step === 5 && (
          <section className="onb-step-pane anim-rise">
            <div className="success-state-onb">
              <div className="ring">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1>
                Your <span className="emph">cockpit</span> is live.
              </h1>
              <p
                className="lead"
                style={{ margin: '0 auto 1.5rem' }}
              >
                Facility provisioned. Athena wired. Invites sent. Routing you to the admin dashboard
                now…
              </p>
              <div style={{ display: 'inline-flex', gap: '0.625rem' }}>
                <Link className="btn btn-primary" href="/app/admin">
                  Open dashboard →
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
