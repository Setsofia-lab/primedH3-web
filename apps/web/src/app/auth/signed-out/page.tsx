import Link from 'next/link';

export default function SignedOutPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-form-col">
        <Link className="auth-logo" href="/">
          <span className="dot" /> PrimedHealth
        </Link>
        <div className="auth-form-inner anim-up" style={{ maxWidth: '28rem' }}>
          <span className="sandbox-pill">
            <span className="dot" /> Signed out
          </span>
          <h1>
            You&apos;re <span className="emph">signed out</span>.
          </h1>
          <p className="lead" style={{ marginTop: '1rem' }}>
            Your session has been ended and your tokens cleared. Close this tab, or sign back in
            if that was accidental.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Link className="btn btn-primary" href="/login">
              Sign back in
            </Link>
            <Link className="btn btn-outline" href="/">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
