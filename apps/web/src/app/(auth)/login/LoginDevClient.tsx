'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSessionStore } from '@/store/session';

const Schema = z.object({
  email: z.string().email('Enter a valid work email.'),
  password: z.string().min(4, 'Use 4 or more characters (demo mode).'),
  remember: z.boolean().optional(),
});
type FormValues = z.infer<typeof Schema>;

export default function LoginDevClient() {
  const router = useRouter();
  const setAuth = useSessionStore((s) => s.setAuth);
  const [pending, setPending] = useState<null | 'email' | 'google' | 'microsoft'>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(Schema), mode: 'onSubmit' });

  const onSubmit = async (data: FormValues) => {
    setPending('email');
    setAuth({ email: data.email, authenticatedAt: new Date().toISOString() });
    // Simulated auth latency for usability testing.
    await new Promise((r) => setTimeout(r, 900));
    if (/onboard|newfacility|admin\+new/i.test(data.email)) {
      router.push('/onboarding');
    } else {
      router.push('/role');
    }
  };

  const ssoLogin = async (provider: 'google' | 'microsoft') => {
    setPending(provider);
    setAuth({ provider, authenticatedAt: new Date().toISOString() });
    await new Promise((r) => setTimeout(r, 1100));
    router.push('/role');
  };

  return (
    <div className="auth-wrap">
      {/* Form column */}
      <div className="auth-form-col">
        <Link className="auth-logo" href="/">
          <span className="dot" /> PrimedHealth
        </Link>

        <div className="auth-form-inner anim-up">
          <span className="sandbox-pill">
            <span className="dot" /> SANDBOX · phase 1 preview
          </span>
          <h1>
            Sign in to your <span className="emph">workflow</span>.
          </h1>
          <p className="lead">
            One login gets you into the right cockpit — surgeon, anesthesia, coordinator, admin, or
            the patient app.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" noValidate>
            <div className="auth-field">
              <label htmlFor="email">Work email</label>
              <div className="input-group">
                <span className="icon">
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
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  className="input"
                  type="email"
                  id="email"
                  placeholder="you@hospital.org"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="err-msg">{errors.email.message}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="input-group">
                <span className="icon">
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  className="input"
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="err-msg">{errors.password.message}</p>}
            </div>

            <div className="auth-options">
              <label className="check-row">
                <input type="checkbox" {...register('remember')} /> Remember this device
              </label>
              <button type="button" className="btn btn-link" style={{ fontSize: '0.875rem' }}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-btn"
              aria-disabled={pending !== null}
              disabled={pending !== null}
            >
              {pending === 'email' ? (
                <>
                  Signing in… <span className="spinner" />
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="divider-row">
            <span className="txt">OR CONTINUE WITH</span>
          </div>

          <div className="sso-row">
            <button
              type="button"
              className="sso-btn"
              onClick={() => ssoLogin('google')}
              disabled={pending !== null}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {pending === 'google' ? 'Connecting…' : 'Google'}
            </button>
            <button
              type="button"
              className="sso-btn"
              onClick={() => ssoLogin('microsoft')}
              disabled={pending !== null}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <rect x="2" y="2" width="9" height="9" fill="#F25022" />
                <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
                <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
                <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
              </svg>
              {pending === 'microsoft' ? 'Connecting…' : 'Microsoft'}
            </button>
          </div>

          <div className="signup-row">
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

      {/* Dark right side */}
      <aside className="auth-side anim-fade">
        <div className="side-top">
          <span>{'// PRIMED.HEALTH'}</span>
          <span>v1.0 · sandbox</span>
        </div>

        <div className="side-content">
          <h2>
            Perioperative coordination, made <span className="emph">seamless</span>.
          </h2>
          <p>
            Agents do the chasing so your team can do the medicine. One orchestrated view replaces
            fax-and-phone workflow.
          </p>

          <div style={{ marginTop: '2rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#A3ADC4',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em',
                marginBottom: '0.625rem',
              }}
            >
              {'// LIVE AGENT ACTIVITY · SANDBOX'}
            </div>
            <div className="agent-row-mini">
              <span className="num">02</span>
              <div>
                <div className="nm">RiskScreeningAgent</div>
                <div style={{ fontSize: '0.75rem', color: '#6B7895' }}>
                  Flagged cardiac consult · case #A-01284
                </div>
              </div>
              <span className="status">
                <span className="pulse" />
                RUNNING
              </span>
            </div>
            <div className="agent-row-mini">
              <span className="num">04</span>
              <div>
                <div className="nm">ReferralAgent</div>
                <div style={{ fontSize: '0.75rem', color: '#6B7895' }}>
                  Sent cardiology consult · ok
                </div>
              </div>
              <span className="status">
                <span className="pulse" />
                RUNNING
              </span>
            </div>
          </div>
        </div>

        <div className="side-foot">{'// no real PHI · practiceID 1128700 · ACS-NSQIP'}</div>
      </aside>
    </div>
  );
}
