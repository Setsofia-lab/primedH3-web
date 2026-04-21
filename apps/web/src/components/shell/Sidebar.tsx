'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSessionStore } from '@/store/session';
import { NAV } from './nav';
import { Icon } from './icons';
import type { Role } from '@/types/session';

interface SidebarProps {
  onSwitchRole: () => void;
}

export function Sidebar({ onSwitchRole }: SidebarProps) {
  const session = useSessionStore((s) => s.session);
  const pathname = usePathname();

  if (!session || session.role === 'patient') return null;

  const role = session.role as Exclude<Role, 'patient'>;
  const items = NAV[role] ?? [];
  const u = session.user;

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
        return (
          <Link key={item.key} className={`nav-item${active ? ' active' : ''}`} href={item.href}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.count != null && <span className="count">{item.count}</span>}
          </Link>
        );
      })}

      <div className="spacer" />

      <div className="user-card">
        <span className="avatar">{u.initials}</span>
        <div className="meta">
          <div className="name">{u.name}</div>
          <div className="role">{u.roleLabel}</div>
        </div>
        <button
          className="switch"
          aria-label="Switch role"
          type="button"
          onClick={onSwitchRole}
        >
          <Icon name="switch" size={14} />
        </button>
      </div>
    </aside>
  );
}
