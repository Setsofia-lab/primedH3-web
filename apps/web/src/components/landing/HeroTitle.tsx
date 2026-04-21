/* Title reveals letter by letter (CSS-driven stagger via inline delays). */

import Link from 'next/link';

function SplitLine({ text, startDelay }: { text: string; startDelay: number }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className="title-letter"
          style={{ animationDelay: `${startDelay + i * 25}ms` }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </>
  );
}

export function HeroTitle() {
  return (
    <div className="hero-title-wrap">
      <h1 className="hero-title" aria-label="Primed Health. Seamless Perioperative Care.">
        <span className="line-1" aria-hidden="true">
          <SplitLine text="PRIMED HEALTH." startDelay={1100} />
        </span>
        <span className="line-2" aria-hidden="true">
          <SplitLine text="Seamless Perioperative Care." startDelay={1400} />
        </span>
      </h1>
      <div className="hero-cta">
        <Link href="/login" className="hero-cta-btn">
          Try the interactive demo
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
        <Link href="/login" className="hero-cta-alt">Sign in →</Link>
      </div>
    </div>
  );
}
