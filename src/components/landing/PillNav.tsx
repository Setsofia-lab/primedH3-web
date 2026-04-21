'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CALENDAR_URL = 'https://calendar.app.google/33oEagGSwW93hgWs9';

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/about',      label: 'About' },
  { href: '/innovation', label: 'Innovation' },
  { href: '/#workflow',  label: 'Workflow' },
];

function CompassMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="compass">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill="currentColor" />
    </svg>
  );
}

export function PillNav() {
  const [open, setOpen] = useState(false);

  // Close on ESC / route change
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open]);

  return (
    <>
      <nav className="pill-nav" aria-label="Primary">
        <Link href="/" className="logo">
          <CompassMark />
          <span className="wordmark">Primed Health</span>
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="link">
            {l.label}
          </Link>
        ))}
        <a
          href={CALENDAR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cta"
        >
          Get Consult
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
        <button
          type="button"
          className="burger"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="7" x2="21" y2="7" />
            <line x1="3" y1="13" x2="21" y2="13" />
            <line x1="3" y1="19" x2="21" y2="19" />
          </svg>
        </button>
      </nav>

      {/* Mobile sheet */}
      <div
        className={`pill-sheet-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
      />
      <div className={`pill-sheet${open ? ' open' : ''}`} role="dialog" aria-label="Menu">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <Link href="/contact" onClick={() => setOpen(false)}>Contact</Link>
        <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
        <a
          href={CALENDAR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-sheet"
          onClick={() => setOpen(false)}
        >
          Get Consult →
        </a>
      </div>
    </>
  );
}
