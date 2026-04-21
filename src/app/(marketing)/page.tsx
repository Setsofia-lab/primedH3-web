import Link from 'next/link';
import { HeroScene } from '@/components/landing/HeroScene';
import { PillNav } from '@/components/landing/PillNav';
import { GlobalClock } from '@/components/landing/GlobalClock';
import { CookieBar } from '@/components/landing/CookieBar';
import { CherryPetals } from '@/components/landing/CherryPetals';
import { GlassInfoCard } from '@/components/landing/GlassInfoCard';
import { FeatureRail } from '@/components/landing/FeatureRail';
import { HeroTitle } from '@/components/landing/HeroTitle';
import {
  IntakePreview,
  ClearancePreview,
  CoordinatorPreview,
  PatientPreview,
  AdminPreview,
} from '@/components/landing/WorkflowPreviews';

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

const WORKFLOW_CARDS: Array<{
  n: string; t: string; d: string;
  Preview: () => React.ReactElement;
  demoHref: string;
}> = [
  { n: '01 · INTAKE',      t: 'Open a case, get a plan',      d: 'Procedure code + history in. Required workup out, with risk flags surfaced before first consult.', Preview: IntakePreview,      demoHref: '/app/surgeon/new' },
  { n: '02 · CLEARANCE',   t: 'Pre-anesthesia, drafted',      d: 'ASA / RCRI / STOP-BANG computed. Cleared, conditional, or deferred in one click.',                  Preview: ClearancePreview,   demoHref: '/app/anesthesia' },
  { n: '03 · COORDINATOR', t: 'A board your agents move',     d: 'Cards slide from Referral to Ready. Coordinators see only what needs a human.',                    Preview: CoordinatorPreview, demoHref: '/app/coordinator' },
  { n: '04 · PATIENT',     t: 'One ring patients understand', d: 'Tasks, messages, education, pre-op kit — one app, installable.',                                   Preview: PatientPreview,     demoHref: '/app/patient' },
  { n: '05 · ADMIN',       t: 'Every action, audited',        d: 'Live streams, prompt edits, append-only audit log, token cost and latency per run.',                Preview: AdminPreview,       demoHref: '/app/admin' },
];

export default function HomePage() {
  return (
    <div className="landing-root">
      {/* HERO */}
      <section className="hero-stage" id="top">
        <HeroScene />
        <CherryPetals />
        <GlobalClock />

        <HeroTitle />

        <GlassInfoCard />
        <FeatureRail />

        {/* Ornament star is baked into the painted hero image */}
      </section>

      <PillNav />
      <CookieBar />

      {/* BODY — folded-in sections */}
      <div className="landing-body">
        {/* §2 THE PROBLEM */}
        <section className="wrap" id="problem">
          <div className="problem-block">
            <div>
              <span className="eyebrow">The problem</span>
              <h2>
                Pre-op coordination is the leading <span className="emph">preventable</span> cause
                of surgical cancellations.
              </h2>
              <p style={{ color: 'var(--ink-500)', marginTop: '1rem', fontSize: '1rem', maxWidth: '52ch' }}>
                A typical pathway involves 8–15 hand-offs between roles. Each one introduces
                latency, omission, and duplication.
              </p>
            </div>
            <div>
              <div className="stat-huge">
                8–15
                <span className="u">hand-offs, per case</span>
              </div>
            </div>
          </div>
        </section>

        {/* §3 WORKFLOW */}
        <section className="wrap" id="workflow">
          <span className="eyebrow">What we do</span>
          <h2>
            One workflow. <span className="emph">Multiple</span> coordinated agents.
          </h2>
          <div className="workflow-rail">
            {WORKFLOW_CARDS.map((c) => {
              const Preview = c.Preview;
              return (
                <Link href={c.demoHref} className="card" key={c.n}>
                  <div className="caption">
                    <span className="n">{c.n}</span>
                    <span className="t">{c.t}</span>
                  </div>
                  <div className="shot">
                    <Preview />
                  </div>
                  <p>{c.d}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* §4 ROSTER */}
        <section className="wrap" id="agents">
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

        {/* §5 CTA */}
        <section className="wrap" id="cta">
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
                Get Consult
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
      </div>
    </div>
  );
}
