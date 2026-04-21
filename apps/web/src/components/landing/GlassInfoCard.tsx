import Link from 'next/link';

export function GlassInfoCard() {
  return (
    <div className="glass-info">
      <span className="pill">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
        </svg>
        Agentic AI
      </span>
      <h3>Intelligent care coordination and assistance.</h3>
      <p>
        Streamlining the patient journey from pre-op to post-op, preventing cancellations through
        AI-driven administrative and clinical flow management.
      </p>
      <Link href="/#workflow" className="more" aria-label="Learn how it works">
        Learn more
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </Link>
    </div>
  );
}
