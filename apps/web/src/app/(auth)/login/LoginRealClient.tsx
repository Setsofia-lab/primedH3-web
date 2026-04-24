'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Pool } from '@/types/session';

interface PoolChoice {
  readonly pool: Pool;
  readonly label: string;
  readonly sub: string;
}

const POOLS: readonly PoolChoice[] = [
  {
    pool: 'admins',
    label: 'Facility admin',
    sub: 'Facility onboarding, agent config, audit log, utilization dashboards.',
  },
  {
    pool: 'providers',
    label: 'Provider',
    sub: 'Surgeon, anesthesia, care coordinator, or allied clinician.',
  },
  {
    pool: 'patients',
    label: 'Patient',
    sub: 'Mobile PWA — readiness, tasks, messages, education.',
  },
];

/**
 * Real-auth login surface. Each button initiates an OAuth PKCE flow
 * against the matching Cognito pool via /api/auth/login?pool=<kind>.
 * The middleware and route handlers do the rest.
 */
export default function LoginRealClient() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <div className="auth-wrap">
      <div className="auth-form-col">
        <Link className="auth-logo" href="/">
          <span className="dot" /> PrimedHealth
        </Link>

        <div className="auth-form-inner anim-up" style={{ maxWidth: '32rem' }}>
          <span className="sandbox-pill">
            <span className="dot" /> Secure sign-in · Cognito
          </span>
          <h1>
            Sign in to your <span className="emph">workflow</span>.
          </h1>
          <p className="lead">
            Pick your login type. You&apos;ll be redirected to the PrimedHealth identity service to
            enter your credentials.
          </p>

          {error ? (
            <div role="alert" style={{ margin: '1rem 0', color: '#b91c1c', fontSize: '0.875rem' }}>
              Sign-in failed ({error}). Try again.
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '0.75rem',
              marginTop: '1.5rem',
            }}
          >
            {POOLS.map((p) => (
              <a
                key={p.pool}
                href={`/api/auth/login?pool=${p.pool}`}
                className="role-card"
                style={{ textAlign: 'left', padding: '1rem 1.125rem' }}
              >
                <div className="name" style={{ marginBottom: '0.25rem' }}>
                  {p.label}
                </div>
                <p className="sub" style={{ margin: 0 }}>
                  {p.sub}
                </p>
                <span className="arrow">Sign in →</span>
              </a>
            ))}
          </div>

          <div className="signup-row" style={{ marginTop: '1.5rem' }}>
            New facility? <Link href="/onboarding">Start onboarding →</Link>
          </div>
        </div>

        <div className="auth-foot-note">
          <span>© 2026 PrimedHealth · HIPAA-aligned by design</span>
          <span>
            <a href="#">Privacy</a> · <a href="#">Terms</a>
          </span>
        </div>
      </div>

      <aside className="auth-side anim-fade">
        <div className="side-top">
          <span>{'// PRIMED.HEALTH'}</span>
          <span>v1.0 · staging</span>
        </div>
        <div className="side-content">
          <h2>
            Perioperative coordination, made <span className="emph">seamless</span>.
          </h2>
          <p>
            Agents do the chasing so your team can do the medicine. One orchestrated view replaces
            the phone tag.
          </p>
        </div>
      </aside>
    </div>
  );
}
