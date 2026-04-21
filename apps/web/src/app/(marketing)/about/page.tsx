import Link from 'next/link';

const CALENDAR_URL = 'https://calendar.app.google/33oEagGSwW93hgWs9';

export default function AboutPage() {
  return (
    <>
      <section className="page-hero wrap anim-up" style={{ paddingTop: '9rem' }}>
        <span className="eyebrow">About</span>
        <h1>
          We&apos;re building the <span className="emph">connective tissue</span> of perioperative care.
        </h1>
        <p>
          PrimedHealth turns the messy, fragmented pre-surgical process into a single coordinated
          workflow — a layer on top of the EHR that automates the repetitive coordination work
          while keeping every human provider in the loop for every clinical decision.
        </p>
      </section>

      <div className="wrap" style={{ marginTop: '2rem' }}>
        <div className="compare">
          <div className="col-box bad anim-rise delay-100">
            <span className="tag">Our bet</span>
            <h3>Agents do the chasing. Clinicians do the medicine.</h3>
            <ul>
              <li>Eight to fifteen hand-offs replaced by one orchestrated view</li>
              <li>Every AI output carries &quot;AI-drafted · review before sending&quot;</li>
              <li>No autonomous clinical decisions, ever</li>
              <li>HIPAA-aligned from day one · SOC 2 Type I in progress</li>
            </ul>
          </div>
          <div className="col-box good anim-rise delay-200">
            <span className="tag">Who it&apos;s for</span>
            <h3>Surgical service lines, end-to-end.</h3>
            <ul>
              <li>Surgeons: case cockpit with AI-drafted H&amp;P and sign-off</li>
              <li>Anesthesia: clearance queue with cited guidelines</li>
              <li>Coordinators: a board your agents actually move</li>
              <li>Patients: one ring, one task list, one day-of checklist</li>
            </ul>
          </div>
        </div>

        <div className="quote-card anim-rise" style={{ marginTop: '3rem' }}>
          <blockquote>
            &quot;The plan is <span className="emph">simple</span>: do the repetitive coordination
            work with agents, and let clinicians do what only they can do.&quot;
          </blockquote>
          <div className="who">{'// founding principle'}</div>
        </div>
      </div>

      <section className="wrap" style={{ marginTop: '4rem', marginBottom: '4rem' }}>
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
              maxWidth: '26ch',
            }}
          >
            Want to pilot Primed at your facility?
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              className="btn btn-primary btn-lg"
              href={CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: 'var(--primary-blue)' }}
            >
              Get Consult →
            </a>
            <Link
              className="btn btn-outline-dark btn-lg"
              href="/login"
              style={{ background: 'transparent', color: '#fff', borderColor: '#1F2A44' }}
            >
              Try the demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
