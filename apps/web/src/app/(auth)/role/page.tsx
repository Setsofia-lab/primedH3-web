'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/session';
import type { Role } from '@/types/session';

interface RoleSlot {
  role: Role;
  label: string;
  sub: string;
  pending: string;
  variant?: 'patient' | 'admin';
  icon: React.ReactNode;
}

const SVG = {
  admin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  surgeon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  anesthesia: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  coordinator: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  allied: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  patient: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
};

const SLOTS: RoleSlot[] = [
  { role: 'admin', label: 'Health-center admin', sub: 'KPI tiles, live agent activity stream, prompt editor, append-only audit log.', pending: 'M5', variant: 'admin', icon: SVG.admin },
  { role: 'surgeon', label: 'Surgeon', sub: 'Case list sorted by readiness score. One-page cockpit. AI-drafted H&P and sign-off.', pending: 'M6', icon: SVG.surgeon },
  { role: 'anesthesia', label: 'Anesthesiologist', sub: 'Color-coded queue. Drafted pre-anesthesia note. Clear / conditional / defer decision.', pending: 'M7', icon: SVG.anesthesia },
  { role: 'coordinator', label: 'Care coordinator', sub: 'Board across five stages. Agents move cards. Needs-attention column surfaces exceptions.', pending: 'M8', icon: SVG.coordinator },
  { role: 'coordinator', label: 'Allied clinician', sub: 'Incoming referrals with context packs already attached. Report progress back.', pending: 'M6b', icon: SVG.allied },
  { role: 'patient', label: 'Patient (mobile PWA)', sub: 'Readiness ring, tasks, messages, education, uploads, day-of checklist. Installs on iOS & Android.', pending: 'M9', variant: 'patient', icon: SVG.patient },
];

export default function RolePickerPage() {
  const router = useRouter();
  const auth = useSessionStore((s) => s.auth);
  const onboarded = useSessionStore((s) => s.onboarded);
  const setSession = useSessionStore((s) => s.setSession);
  const signOut = useSessionStore((s) => s.signOut);
  const signedAs = auth?.email ?? (auth?.provider ? `Signed in via ${auth.provider}` : 'Signed in');

  const pick = (slot: RoleSlot) => {
    setSession(slot.role);
    if (slot.role === 'admin' && !onboarded) {
      router.push('/onboarding');
    } else if (slot.role === 'patient') {
      router.push('/app/patient');
    } else {
      router.push(`/app/${slot.role}`);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <div className="role-shell">
      <div className="role-topbar">
        <Link className="auth-logo" href="/">
          <span className="dot" /> PrimedHealth
        </Link>
        <span className="signed-in">
          <span className="dot-ok" /> {signedAs}
        </span>
      </div>

      <main>
        <section className="role-page-hero anim-up">
          <span className="eyebrow-center">Step into any role</span>
          <h1>
            Which <span className="emph">cockpit</span> are you in today?
          </h1>
          <p>
            Your account has access to every surface. Pick a role and we&apos;ll take you to the
            right workspace. You can switch any time from the sidebar.
          </p>
        </section>

        <div className="roles-xl">
          {SLOTS.map((s, i) => (
            <button
              key={`${s.role}-${i}`}
              type="button"
              onClick={() => pick(s)}
              className={`role-card${s.variant === 'admin' ? ' admin-card' : ''}${s.variant === 'patient' ? ' patient' : ''} anim-rise delay-${100 + i * 100}`}
            >
              <span
                className="role-pending"
                style={
                  s.variant === 'admin'
                    ? { background: 'rgba(255,255,255,0.1)', color: '#A3ADC4' }
                    : s.variant === 'patient'
                      ? { background: 'rgba(255,255,255,0.7)' }
                      : undefined
                }
              >
                {s.pending}
              </span>
              <div className="ic">{s.icon}</div>
              <div className="name">{s.label}</div>
              <p className="sub">{s.sub}</p>
              <span className="arrow">Open →</span>
            </button>
          ))}
        </div>

        <div className="switch-row">
          Not you?{' '}
          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>

        <div className="role-note">
          {'// no real PHI · all patients are obviously synthetic · practiceID 1128700 · sandbox mode'}
        </div>
      </main>
    </div>
  );
}
