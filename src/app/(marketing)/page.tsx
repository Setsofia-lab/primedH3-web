import Link from 'next/link';

const AGENTS = [
  { num: '01', name: 'IntakeOrchestrator', role: 'Builds the required-workup plan', model: 'claude-sonnet' },
  { num: '02', name: 'RiskScreeningAgent', role: 'NSQIP screen across 100+ conditions', model: 'claude-opus' },
  { num: '03', name: 'AnesthesiaClearanceAgent', role: 'Drafts ASA / RCRI / STOP-BANG', model: 'claude-opus' },
  { num: '04', name: 'ReferralAgent', role: 'Specialty referrals with context pack', model: 'claude-sonnet' },
  { num: '05', name: 'SchedulingAgent', role: 'Finds slots across calendars', model: 'claude-haiku' },
  { num: '06', name: 'PatientCommsAgent', role: 'Triaged patient messaging', model: 'claude-sonnet' },
  { num: '07', name: 'PreHabAgent', role: 'Prescribes and tracks pre-hab', model: 'claude-haiku' },
  { num: '08', name: 'DocumentationAgent', role: 'Drafts H&Ps, posts via Athena MCP', model: 'claude-sonnet' },
  { num: '09', name: 'TaskTrackerAgent', role: 'Kanban mirror via Asana MCP', model: 'claude-haiku' },
  { num: '10', name: 'ReadinessAgent', role: 'Continuous 0–100 readiness score', model: 'claude-sonnet' },
];

const STATS = [
  { n: '−50%', l: 'Same-day cancellations' },
  { n: '−40%', l: 'Time to surgical readiness' },
  { n: '−30%', l: 'Provider coordination time' },
  { n: '4.5/5', l: 'Patient clarity score (target)' },
];

const HERO_ROWS = [
  { name: 'Alex Rivera', proc: 'Lap chole · Apr 28', avBg: '#FDECEC', avFg: '#B23232', initials: 'AR', badge: { v: 'badge-warning', t: 'Conditional' }, asa: 'ASA II', pct: 82, dashOff: 10.2 },
  { name: 'Jordan Park', proc: 'Total knee · May 02', avBg: '#E7F8F1', avFg: '#047857', initials: 'JP', badge: { v: 'badge-success', t: 'Cleared' }, asa: 'ASA II', pct: 95, dashOff: 2.8 },
  { name: 'Maya Khan', proc: 'Hernia repair · May 05', avBg: undefined, avFg: undefined, initials: 'MK', badge: { v: 'badge-info', t: 'Workup' }, asa: 'ASA I', pct: 60, dashOff: 22.6 },
  { name: 'Daniel Shaw', proc: 'Tonsillectomy · May 10', avBg: 'var(--ink-900)', avFg: '#fff', initials: 'DS', badge: { v: 'badge-danger', t: 'Deferred' }, asa: 'ASA III', pct: 35, dashOff: 36.7 },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="hero wrap">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">AI-orchestrated perioperative platform</span>
            <h1>
              Perioperative Coordination made <span className="emph">seamless</span>.
            </h1>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" href="/contact">
                Book a meeting
              </Link>
              <Link className="btn btn-outline-dark btn-lg" href="/login">
                See a demo →
              </Link>
            </div>
            <div className="trust-row">
              <span>HIPAA-ALIGNED</span>
              <span className="divider" />
              <span>ATHENA EHR</span>
              <span className="divider" />
              <span>AWS BEDROCK</span>
              <span className="divider" />
              <span>HUMAN-IN-THE-LOOP</span>
            </div>
          </div>

          <div className="mockup-stack">
            <div className="mockup">
              <div className="mock-head">
                <span className="title">My cases · today</span>
                <span className="meta">
                  <span className="badge badge-ai">AI-drafted</span>
                  <span className="badge badge-neutral">12 total</span>
                </span>
              </div>

              {HERO_ROWS.map((r, i) => (
                <div className="row-cells" key={i}>
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
            <div className="phone phone-float">
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

        <div className="stats">
          {STATS.map((s) => (
            <div className="stat" key={s.l}>
              <div className="n">{s.n}</div>
              <div className="l">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="section wrap" id="services">
        <div className="services-intro">
          <div>
            <span className="eyebrow">What we do</span>
            <h2>
              One workflow. <span className="emph">Ten</span> coordinated agents. Every decision, a
              human click.
            </h2>
          </div>
        </div>

        <div className="tile-grid">
          <div className="tile blue" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">01 · Intake</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Turn a procedure code into a complete{' '}
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
                </span>{' '}
                in seconds.
              </h3>
            </div>
            <p className="tile-body">History, procedure code, risk factors in — task list out.</p>
          </div>

          <div className="tile" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">02 · Risk</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                NSQIP-aligned screen across 100+ conditions.
              </h3>
            </div>
            <p className="tile-body">ASA, RCRI, STOP-BANG — continuously updated.</p>
          </div>

          <div className="tile" style={{ gridColumn: 'span 4' }}>
            <div>
              <span className="tile-caption">03 · Clearance</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Pre-anesthesia note, drafted.
              </h3>
            </div>
            <p className="tile-body">The note is already there. Clear, edit, or defer.</p>
          </div>

          <div className="tile blue" style={{ gridColumn: 'span 4' }}>
            <div>
              <span className="tile-caption">04 · Referrals</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Referrals ship with the context already attached.
              </h3>
            </div>
            <p className="tile-body">Chart, imaging, and the question — packaged.</p>
          </div>

          <div className="tile dark" style={{ gridColumn: 'span 4' }}>
            <div>
              <span className="tile-caption">05 · Scheduling</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Finds the slot everyone can keep.
              </h3>
            </div>
            <p className="tile-body">Calendars, availability, preferences — one call.</p>
          </div>

          <div className="tile" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">06 · Patient</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                A readiness ring patients actually understand.
              </h3>
            </div>
            <p className="tile-body">Tasks, messages, education, uploads, day-of.</p>
          </div>

          <div className="tile blue" style={{ gridColumn: 'span 6' }}>
            <div>
              <span className="tile-caption">07 · Admin</span>
              <h3 className="tile-title" style={{ marginTop: '0.75rem' }}>
                Every agent action, audited.
              </h3>
            </div>
            <p className="tile-body">Live streams, prompt edits, model swaps, audit log.</p>
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section className="wrap">
        <div className="agents-section">
          <div className="grid-bg" />
          <div style={{ position: 'relative', maxWidth: '64ch' }}>
            <span className="eyebrow" style={{ color: '#C9D8FF' }}>
              The roster
            </span>
            <h2>Ten agents. One contract. Zero autonomous clinical decisions.</h2>
          </div>
          <div className="agents-list">
            {AGENTS.map((a) => (
              <div className="agent-row" key={a.num}>
                <span className="num">{a.num}</span>
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="role">{a.role}</div>
                </div>
                <span className="model">{a.model}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="section wrap">
        <span className="eyebrow">How a case moves</span>
        <h2>
          From procedure code to operating table, in one <span className="emph">continuous</span>{' '}
          workflow.
        </h2>
        <div className="flow">
          <div className="step">
            <span className="n">01 · REFERRAL</span>
            <h3 className="serif">A case opens</h3>
            <p>Surgeon picks a procedure. The workup plan drafts itself.</p>
          </div>
          <div className="step">
            <span className="n">02 · WORKUP</span>
            <h3 className="serif">Agents chase what&apos;s missing</h3>
            <p>Risk, referrals, scheduling, docs — each slice logged and escalated.</p>
          </div>
          <div className="step">
            <span className="n">03 · CLEARANCE</span>
            <h3 className="serif">Humans sign off</h3>
            <p>Anesthesia clears, surgeon clears. Readiness hits 100.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap">
        <div className="cta-band">
          <div>
            <h2>
              Modernize your surgical workflow. Start with a{' '}
              <span className="emph">30-minute</span> conversation.
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link
              className="btn btn-primary btn-lg"
              href="/contact"
              style={{ justifyContent: 'center' }}
            >
              Book a meeting
            </Link>
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
