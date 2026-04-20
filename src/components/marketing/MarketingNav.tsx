'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/problem', label: 'The problem' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Primary">
        <Link className="logo" href="/">
          <span className="dot" /> PrimedHealth
        </Link>
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            className={cn('nav-link', pathname === l.href && 'active')}
            href={l.href}
          >
            {l.label}
          </Link>
        ))}
        <span className="spacer" />
        <div className="actions">
          <Link className="btn btn-outline-dark btn-sm nav-link mobile-keep" href="/login">
            Sign in
          </Link>
          <Link className="btn btn-dark btn-sm" href="/contact">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
            </svg>
            Book a meeting
          </Link>
        </div>
      </nav>
    </div>
  );
}
