'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSessionStore } from '@/store/session';
import { NAV } from './nav';
import { Icon } from './icons';
import { useNavCounts } from './use-nav-counts';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { Role } from '@/types/session';

const ROLE_LABEL: Record<Exclude<Role, 'patient'>, string> = {
  admin: 'Health-center admin',
  surgeon: 'Surgeon',
  anesthesia: 'Anesthesiologist',
  coordinator: 'Coordinator',
  allied: 'Allied clinician',
};

function initialsFor(first: string, last: string): string {
  const f = (first || '').trim()[0] ?? '';
  const l = (last || '').trim()[0] ?? '';
  return (f + l || '?').toUpperCase();
}

export function Sidebar() {
  const liveUser = useCurrentUser();
  const session = useSessionStore((s) => s.session);
  const pathname = usePathname();

  // Prefer the live Cognito-backed identity. Fall back to the Phase-1
  // mock store for dev-auth mode and the brief moment before /me lands.
  const role = (liveUser?.role ?? session?.role) as Role | undefined;
  const counts = useNavCounts(role ?? 'patient');

  if (!role || role === 'patient') return null;

  const items = NAV[role as Exclude<Role, 'patient'>] ?? [];

  const display = liveUser
    ? {
        name: `${liveUser.firstName} ${liveUser.lastName}`.trim() || liveUser.email,
        roleLabel: ROLE_LABEL[role as Exclude<Role, 'patient'>] ?? role,
        initials: initialsFor(liveUser.firstName, liveUser.lastName),
      }
    : session?.user ?? { name: 'Loading…', roleLabel: '', initials: '…' };

  return (
    <aside className="sidebar" id="app-sidebar">
      <Link className="brand" href="/app">
        <span className="dot" /> PrimedHealth
      </Link>

      {items.map((item, i) => {
        if ('section' in item) {
          return (
            <div className="section-label" key={`sec-${i}`}>
              {item.section}
            </div>
          );
        }
        const active = pathname === item.href;
        const count = counts[item.key];
        return (
          <Link key={item.key} className={`nav-item${active ? ' active' : ''}`} href={item.href}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {typeof count === 'number' && <span className="count">{count}</span>}
          </Link>
        );
      })}

      <div className="spacer" />

      <div className="user-card">
        <span className="avatar">{display.initials}</span>
        <div className="meta">
          <div className="name">{display.name}</div>
          <div className="role">{display.roleLabel}</div>
        </div>
        <a
          className="switch"
          aria-label="Sign out"
          title="Sign out"
          href="/api/auth/signout"
        >
          <Icon name="signout" size={14} />
        </a>
      </div>
    </aside>
  );
}
