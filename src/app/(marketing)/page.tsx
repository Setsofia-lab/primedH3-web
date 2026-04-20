import Link from 'next/link';

const CALENDAR_URL = 'https://calendar.app.google/33oEagGSwW93hgWs9';

/* Roster — clinically ordered. Scheduling agent intentionally dropped
   per product feedback (own complex domain, deferred offering). */
const AGENTS = [
  { num: '01', name: 'IntakeOrchestrator',       role: 'Builds the required-workup plan' },
  { num: '02', name: 'AnesthesiaClearanceAgent', role: 'Drafts ASA / RCRI / STOP-BANG' },
  { num: '03', name: 'DocumentationAgent',       role: 'Drafts H&Ps from Athena' },
  { num: '04', name: 'ReferralAgent',            role: 'Specialty referrals with context pack' },
  { num: '05', name: 'PatientCommsAgent',        role: 'Triaged patient messaging' },
  { num: '06', name: 'ReadinessAgent',           role: 'Continuous 0–100 readiness score' },
  { num: '07', name: 'PreHabAgent',              role: 'Prescribes and tracks pre-hab' },
  { num: '08', name: 'TaskTrackerAgent',         role: 'Coordinator board with smart routing' },
  { num: '09', name: 'RiskScreeningAgent',       role: 'Background risk screening' },
];

/* Qualitative outcomes — no numeric stats until pilot data backs them up. */
const OUTCOMES = [
  { n: 'Fewer',   l: 'Same-day cancellations' },
  { n: 'Faster',  l: 'Time to surgical readiness' },
  { n: 'Less',    l: 'Coordination overhead' },
  { n: 'Clearer', l: 'Patient experience' },
];

const HERO_ROWS = [
  { name: 'Alex Rivera',  proc: 'Lap chole · Apr 28',     avBg: '#FDECEC',       avFg: '#B23232', initials: 'AR', badge: { v: 'badge-warning', t: 'Conditional' }, asa: 'ASA II',  pct: 82, dashOff: 10.2 },
  { name: 'Jordan Park',  proc: 'Total knee · May 02',    avBg: '#E7F8F1',       avFg: '#047857', initials: 'JP', badge: { v: 'badge-success', t: 'Cleared' },     asa: 'ASA II',  pct: 95, dashOff: 2.8 },
  { name: 'Maya Khan',    proc: 'Hernia repair · May 05', avBg: undefined,       avFg: undefined, initials: 'MK', badge: { v: 'badge-info',    t: 'Workup' },      asa: 'ASA I',   pct: 60, dashOff: 22.6 },
  { name: 'Daniel Shaw',  proc: 'Tonsillectomy · May 10', avBg: 'var(--ink-900)', avFg: '#fff',   initials: 'DS', badge: { v: 'badge-danger',  t: 'Deferred' },    asa: 'ASA III', pct: 35, dashOff: 36.7 },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="hero wrap">
        <div className="hero-grid">
          <div className="anim-up">
            <span className="eyebrow">AI-orchestrated perioperative platform</span>
            <h1>
              Perioperative Coordination made <span className="emph">seamless</span>.
            </h1>
            <div className="hero-actions anim-up delay-200">
              <a className="btn btn-primary btn-lg" href={CALENDAR_URL} target="_blank" rel="noopener noreferrer">
                Book a meeting
              </a>
              <Link className="btn btn-outline-dark btn-lg" href="/login">
                See a demo →
              </Link>
            </div>
            <div className="trust-row anim-fade delay-400">
              <span>HIPAA-ALIGNED</span>
              <span className="divider" />
              <span>HUMAN-IN-THE-LOOP</span>
            </div>
          </div>

          <div className="mockup-stack anim-rise delay-200">
            <div className="mockup">
              <div className="mock-head">
                <span className="title">My cases · today</span>
                <span className="meta">
                  <span className="badge badge-ai">AI-drafted</span>
                  <span className="badge badge-neutral">12 total</span>
                </span>
              </div>

              {HERO_ROWS.map((r, i) => (
                <div className={`row-cells anim-up delay-${300 + i * 100}`} key={i}>
                  <div className="nm">
                    <span
                      className="avatar"
                      style={r.avBg ? { background: r.avBg, color: r.avFg } : undefined}
                    >
                      {r.initials}
                    </span>
                    <div>
                      {r.name}
                      <div className="sub">{r.proc}</div>
                    </div>
                  </div>
                  <span className={`badge ${r.badge.v}`}>{r.badge.t}</span>
                  <span className="badge badge-neutral" style={{ justifySelf: 'start' }}>
                    {r.asa}
                  </span>
                  <div className="ring-cell">
                    <svg className="mini-ring" viewBox="0 0 24 24">
                      <circle className="track" cx="12" cy="12" r="9" strokeWidth="3" />
                      <circle
                        className="fill"
                        cx="12"
                        cy="12"
                        r="9"
                        strokeWidth="3"
                        strokeDasharray="56.5"
                        strokeDashoffset={r.dashOff}
                      />
                    </svg>
                    {r.pct}%
                  </div>
                </div>
              ))}
            </div>

            {/* Floating phone */}
            <div className="phone phone-float anim-float-soft">
              <div className="notch" />
              <div className="greeting">Good morning, Alex</div>
              <div className="ring-big ring-wrap-phone">
                <svg viewBox="0 0 120 120">
                  <circle className="track" cx="60" cy="60" r="52" strokeWidth="10" />
                  <circle
                    className="fill"
                    cx="60"
                    cy="60"
                    r="52"
                    strokeWidth="10"
                    strokeDasharray="326.7"
                    strokeDashoffset="58.8"
                  />
                </svg>
                <div className="lbl">
                  <span style={{ fontSize: '2rem', color: 'var(--ink-900)' }}>82</span>
                  <span className="t-caption">READINESS</span>
                </div>
              </div>
              <div className="task">
                <span className="check">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                Pre-op questionnaire
              </div>
              <div className="task todo">
                <span className="check" />
                Upload medication list
              </div>
              <div className="task todo">
                <span className="check" />
                Pre-hab walk · 15 min
              </div>
            </div>
          </div>
        </div>

        {/* Outcomes (qualitative — no numeric claims yet) */}
        <div className="stats anim-up delay-500">
          {OUTCOMES.map((s) => (
            <div className="stat" key={s.l}>
              <div className="n">{s.n}</div>
              <div className="l">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="section wrap" id="services">
        <div className="services-intro anim-up">
          <div>
            <span className="eyebrow">What we do</span>
            <h2>
              One workflow. <span className="emph">Multiple</span> coordinated agents. Every
              decision, a human in the loop.
            </h2>
          </div>
        </div>

        <div className="tile-grid">
          <div className="tile blue anim-rise delay-100" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">01 · Intake</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                A procedure code becomes a complete{' '}
                <span
                  className="emph"
                  style={{
                    fontStyle: 'italic',
                    textDecoration: 'underline',
                    textDecorationColor: 'var(--primary-blue)',
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '3px',
                  }}
                >
                  workup plan
                </span>
                .
              </h3>
            </div>
            <p className="tile-body">History, code, risk factors in. Task list out.</p>
          </div>

          <div className="tile anim-rise delay-200" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">02 · Clearance</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                The pre-anesthesia note is already drafted.
              </h3>
            </div>
            <p className="tile-body">Clear, edit, or defer.</p>
          </div>

          <div className="tile anim-rise delay-300" style={{ gridColumn: 'span 4' }}>
            <div>
              <span className="tile-caption">03 · Referrals</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Referrals ship with context attached.
              </h3>
            </div>
            <p className="tile-body">Chart, imaging, the question — packaged.</p>
          </div>

          <div className="tile blue anim-rise delay-400" style={{ gridColumn: 'span 4' }}>
            <div>
              <span className="tile-caption">04 · Patient</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                A readiness ring patients understand.
              </h3>
            </div>
            <p className="tile-body">Tasks, messages, education, day-of.</p>
          </div>

          <div className="tile dark anim-rise delay-500" style={{ gridColumn: 'span 4' }}>
            <div>
              <span className="tile-caption">05 · Coordinator</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                A board your agents move.
              </h3>
            </div>
            <p className="tile-body">Coordinators see only exceptions.</p>
          </div>

          <div className="tile anim-rise delay-500" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">06 · Admin</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Every agent action, audited.
              </h3>
            </div>
            <p className="tile-body">Live streams, prompt edits, append-only audit log.</p>
          </div>

          <div className="tile blue anim-rise delay-700" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">07 · Risk</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Continuous risk screening, in the background.
              </h3>
            </div>
            <p className="tile-body">ASA, RCRI, STOP-BANG — recomputed on every change.</p>
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section className="wrap">
        <div className="agents-section anim-rise">
          <div className="grid-bg" />
          <div style={{ position: 'relative', maxWidth: '64ch' }}>
            <span className="eyebrow" style={{ color: '#C9D8FF' }}>
              The roster
            </span>
            <h2>Multiple agents. One contract. Zero autonomous clinical decisions.</h2>
          </div>
          <div className="agents-list">
            {AGENTS.map((a, i) => (
              <div
                className={`agent-row no-model anim-up delay-${100 + (i % 5) * 100}`}
                key={a.num}
              >
                <span className="num">{a.num}</span>
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="role">{a.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="wrap">
        <div className="cta-band">
          <div>
            <h2>
              Modernize your surgical workflow. Start with a{' '}
              <span className="emph">30-minute</span> conversation.
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a
              className="btn btn-primary btn-lg"
              href={CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ justifyContent: 'center' }}
            >
              Book a meeting
            </a>
            <Link
              className="btn btn-outline-dark btn-lg"
              href="/login"
              style={{
                background: 'transparent',
                color: '#fff',
                borderColor: '#1F2A44',
                justifyContent: 'center',
              }}
            >
              Try the interactive demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
