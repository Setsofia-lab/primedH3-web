import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="logo-block">
              <span className="dot" /> PrimedHealth
            </div>
            <p
              style={{
                color: '#A3ADC4',
                maxWidth: '36ch',
                fontSize: '0.9375rem',
                lineHeight: 1.55,
              }}
            >
              Perioperative coordination, made seamless. One workflow for surgeons, anesthesia,
              coordinators, and patients.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li>
                <Link href="/services">Services</Link>
              </li>
              <li>
                <Link href="/problem">The problem</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
              <li>
                <Link href="/onboarding">Request a demo</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li>
                <a href="#">About</a>
              </li>
              <li>
                <a href="#">Security</a>
              </li>
              <li>
                <a href="#">Clinical advisors</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li>
                <a href="mailto:adwaiy@primedhealth.ai">adwaiy@primedhealth.ai</a>
              </li>
              <li>
                <a
                  href="https://calendar.app.google/33oEagGSwW93hgWs9"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Book a meeting
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="bottom">
          <span>© 2026 PrimedHealth · HIPAA-aligned by design.</span>
          <span>
            <a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Security</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
