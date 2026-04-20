import Link from 'next/link';

const CALENDAR_URL = 'https://calendar.app.google/33oEagGSwW93hgWs9';

/* 4 stages per product feedback (Pre-hab dropped — only used in a small
   set of surgeries; Day-of renamed to Pre-Op). */
const JOURNEY_STEPS = [
  { hand: '3 hand-offs', n: '01', name: 'Referral',  sub: 'PCP → surgeon → scheduler' },
  { hand: '4 hand-offs', n: '02', name: 'Workup',    sub: 'Labs, imaging, specialty consults' },
  { hand: '3 hand-offs', n: '03', name: 'Clearance', sub: 'Anesthesia, cardiology, endo' },
  { hand: '3 hand-offs', n: '04', name: 'Pre-Op',    sub: 'NPO, meds, arrival, logistics' },
];

const TODAY_LIST = [
  'Faxed clearances lost in a stack',
  'Patients re-tell their story five times',
  'Coordinators spend most of their day chasing',
  'Cancellations discovered at 6 AM',
];

const PRIMED_LIST = [
  'Clearances draft themselves; humans review',
  'Patient context follows the patient',
  'Coordinators see only exceptions',
  'Readiness recomputes on every event',
];

export default function ProblemPage() {
  return (
    <>
      <section className="page-hero wrap anim-up">
        <span className="eyebrow">The problem</span>
        <h1>
          Pre-op coordination is the leading <span className="emph">preventable</span> cause of
          surgical cancellations.
        </h1>
        <p>
          A typical pathway involves 8–15 hand-offs between roles. Each one introduces latency,
          omission, and duplication.
        </p>
      </section>

      <div className="wrap">
        <div className="stat-band">
          <div className="stat-card anim-rise delay-100">
            <div className="n">
              8–15<span className="unit">handoffs</span>
            </div>
            <div className="desc">Hand-offs between roles in a typical pre-op pathway.</div>
          </div>
          <div className="stat-card anim-rise delay-200">
            <div className="n">#1</div>
            <div className="desc">
              Pre-op coordination failures are the leading preventable cause of same-day
              cancellations.
            </div>
          </div>
          <div className="stat-card anim-rise delay-300">
            <div className="n">$B+</div>
            <div className="desc">
              Annual cost to U.S. health systems from avoidable delays and cancellations.
            </div>
          </div>
        </div>

        <div className="journey anim-up">
          <span className="eyebrow">The current pathway</span>
          <h2>Four stages. Dozens of hand-offs. No single owner.</h2>
          <div className="journey-steps">
            {JOURNEY_STEPS.map((s, i) => (
              <div className={`s anim-up delay-${100 + i * 100}`} key={s.n}>
                <span className="hand">{s.hand}</span>
                <span className="n">{s.n}</span>
                <div className="name">{s.name}</div>
                <div className="sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="compare">
          <div className="col-box bad anim-rise delay-100">
            <span className="tag">Today</span>
            <h3>Phone tag, fax chains, spreadsheets.</h3>
            <ul>
              {TODAY_LIST.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="col-box good anim-rise delay-200">
            <span className="tag">With PrimedHealth</span>
            <h3>One workflow. Every action logged.</h3>
            <ul>
              {PRIMED_LIST.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="quote-card anim-rise">
          <blockquote>
            &quot;The plan is <span className="emph">simple</span>: do the repetitive coordination
            work with agents, and let clinicians do what only they can do.&quot;
          </blockquote>
          <div className="who">{'// TODO: replace with pilot clinician quote'}</div>
        </div>
      </div>

      <section className="wrap" style={{ marginTop: '4rem' }}>
        <div
          className="anim-rise"
          style={{
            background: 'var(--ink-900)',
            color: '#fff',
            borderRadius: 'var(--radius-2xl)',
            padding: '3rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '2rem',
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              margin: 0,
              color: '#fff',
              maxWidth: '22ch',
            }}
          >
            See the pathway end-to-end, with mocked agents running live.
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link
              className="btn btn-primary btn-lg"
              href="/login"
              style={{ background: 'var(--primary-blue)' }}
            >
              Open the demo →
            </Link>
            <a
              className="btn btn-outline-dark btn-lg"
              href={CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent',
                color: '#fff',
                borderColor: '#1F2A44',
              }}
            >
              Book a meeting
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
