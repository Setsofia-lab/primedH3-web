import Link from 'next/link';

const KANBAN = [
  { col: 'Referral', cards: ['Shaw · ENT', 'Rivera · Anes'] },
  { col: 'Workup', cards: ['Khan · Labs', 'Lee · ECG', 'Patel · CXR'] },
  { col: 'Clearance', cards: ['Park · Anes', 'Ortiz · Cardio'] },
  { col: 'Ready', cards: ['Gomez · T-2d'] },
];

export default function ServicesPage() {
  return (
    <>
      <section className="page-hero wrap">
        <span className="eyebrow">What PrimedHealth delivers</span>
        <h1>
          A <span className="emph">single</span> workflow that replaces eight to fifteen hand-offs.
        </h1>
        <p>
          Every service below is live from day one. Agents simulate in Phase 1, run against Bedrock
          in Phase 3 — the contract never changes, so the UI never rewrites.
        </p>
      </section>

      <div className="wrap">
        {/* 01 Intake */}
        <section className="service-block">
          <div className="meta">
            <div className="num-big">01</div>
            <span className="label">Intake & workup</span>
            <h2>Turn a procedure code into a complete plan.</h2>
            <p className="lede">Open a case. The workup plan drafts itself.</p>
            <ul>
              <li>Pulls history, meds, and prior encounters from Athena</li>
              <li>Generates the required-workup list by procedure code</li>
              <li>Surfaces risk flags before the first consult goes out</li>
            </ul>
          </div>
          <div className="demo-panel">
            <div className="head">
              <span className="t">IntakeOrchestrator · streaming</span>
              <span className="badge badge-ai">AI-drafted</span>
            </div>
            <div className="line">
              <span className="t-stamp">09:14:02</span>
              <span>
                <span className="tag">TOOL</span>
                athena.get_patient(id=alex-rivera)
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">09:14:02</span>
              <span>
                <span className="tag">TOOL</span>
                athena.list_encounters(limit=10)
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">09:14:04</span>
              <span>
                <span className="tag">DRAFT</span>
                workup: {'{ cbc, bmp, ecg, cxr, anesthesia_consult }'}
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">09:14:04</span>
              <span>
                <span className="tag">DRAFT</span>
                risk_flags: [ hx_osa, hx_htn ]
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">09:14:05</span>
              <span>
                <span className="tag">READY</span>
                Awaiting surgeon review · 3 items flagged
              </span>
            </div>
          </div>
        </section>

        {/* 02 Risk */}
        <section className="service-block">
          <div className="meta">
            <div className="num-big">02</div>
            <span className="label">Risk screening</span>
            <h2>NSQIP-aligned screen, continuously.</h2>
            <p className="lede">Every change runs a fresh screen. Deltas, not dashboards.</p>
            <ul>
              <li>100+ condition screens referenced against ACS NSQIP, ASA, AAGBI</li>
              <li>Clinical content cited; nothing invented</li>
              <li>Flags escalate to the named coordinator within the hour</li>
            </ul>
          </div>
          <div className="demo-panel">
            <div className="head">
              <span className="t">RiskScreeningAgent · last run</span>
              <span className="badge badge-warning">3 flags</span>
            </div>
            <div className="line" style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-900)' }}>
              <span className="badge badge-ai">ASA II</span> Mild systemic disease · well-controlled HTN
            </div>
            <div className="line" style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-900)' }}>
              <span className="badge badge-warning">RCRI 1</span> Creatinine 1.4 — below cutoff, watch at 30d
            </div>
            <div className="line" style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-900)' }}>
              <span className="badge badge-warning">STOP-BANG 4</span> Intermediate OSA risk · ref to sleep
            </div>
            <div
              className="line"
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '0.75rem',
                marginTop: '0.5rem',
              }}
            >
              <span className="t-stamp">{'// TODO: clinical review — thresholds per ACS NSQIP v2024'}</span>
            </div>
          </div>
        </section>

        {/* 03 Coordinator */}
        <section className="service-block">
          <div className="meta">
            <div className="num-big">03</div>
            <span className="label">Coordinator board</span>
            <h2>Kanban your agents actually move.</h2>
            <p className="lede">Cards slide from Referral to Ready. Exceptions pop to Needs-Attention.</p>
            <ul>
              <li>Mirrors to Asana via MCP (Phase 3)</li>
              <li>Every move is auditable</li>
              <li>Coordinator sees only what needs human judgment</li>
            </ul>
          </div>
          <div className="demo-panel">
            <div className="head">
              <span className="t">Coordinator board · live</span>
              <span className="badge badge-ai">20 cases</span>
            </div>
            <div className="kanban-mini">
              {KANBAN.map((c) => (
                <div className="col" key={c.col}>
                  <h4>{c.col}</h4>
                  {c.cards.map((card) => (
                    <div className="card-mini" key={card}>
                      {card}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 04 Patient */}
        <section className="service-block">
          <div className="meta">
            <div className="num-big">04</div>
            <span className="label">Patient PWA</span>
            <h2>The patient is the connector.</h2>
            <p className="lede">One ring. One task list. One day-of checklist.</p>
            <ul>
              <li>Magic-link login · camera-first uploads</li>
              <li>Education, messages, schedule — one app</li>
              <li>Day-of: NPO, meds to hold, arrival time, what to bring</li>
            </ul>
          </div>
          <div className="demo-panel">
            <div className="readiness-demo">
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
              <div>
                <div className="t-caption">READINESS</div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2.5rem',
                    lineHeight: 1,
                    fontFeatureSettings: '"ss01","cv11"',
                  }}
                >
                  82
                </div>
                <p
                  style={{
                    color: 'var(--ink-500)',
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                  }}
                >
                  On track for April 28. Two tasks left.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 05 Admin */}
        <section className="service-block">
          <div className="meta">
            <div className="num-big">05</div>
            <span className="label">Admin & audit</span>
            <h2>Every agent action, append-only.</h2>
            <p className="lede">KPIs, live streams, prompt editor. Every action audited.</p>
            <ul>
              <li>Immutable audit log of agent actions + human overrides</li>
              <li>Token cost and latency per run</li>
              <li>LangSmith traces link out in Phase 3</li>
            </ul>
          </div>
          <div className="demo-panel">
            <div className="head">
              <span className="t">Activity stream</span>
              <span className="badge badge-neutral">last 30s</span>
            </div>
            <div className="line">
              <span className="t-stamp">12:41:08</span>
              <span>
                <span className="tag">ReadinessAgent</span> recomputed case=rivera → 82 (+4)
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">12:41:05</span>
              <span>
                <span className="tag">SchedulingAgent</span> calendar.find_slots(provider=cardio,
                from=apr20)
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">12:40:59</span>
              <span>
                <span className="tag">PatientCommsAgent</span> sent message · case=khan · drafted ✓
                reviewed
              </span>
            </div>
            <div className="line">
              <span className="t-stamp">12:40:51</span>
              <span>
                <span className="tag">ReferralAgent</span> asana.create_task(cardio consult) · ok
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* CTA */}
      <section className="wrap" style={{ marginTop: '3rem' }}>
        <div
          style={{
            background: 'var(--card-blue-50)',
            borderRadius: 'var(--radius-2xl)',
            padding: '3rem',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 400,
              letterSpacing: '-0.015em',
            }}
          >
            Ready to see it{' '}
            <span
              className="emph"
              style={{
                fontStyle: 'italic',
                textDecoration: 'underline',
                textDecorationColor: 'var(--primary-blue)',
                textDecorationThickness: '3px',
                textUnderlineOffset: '5px',
              }}
            >
              moving
            </span>
            ?
          </h2>
          <p style={{ color: 'var(--ink-500)', marginTop: '0.75rem' }}>
            Walk through a simulated case end-to-end — admin, surgeon, anesthesia, coordinator,
            patient.
          </p>
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link className="btn btn-primary btn-lg" href="/login">
              Open the demo
            </Link>
            <Link className="btn btn-outline-dark btn-lg" href="/contact">
              Book a meeting
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
