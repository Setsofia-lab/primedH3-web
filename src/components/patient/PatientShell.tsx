'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PatientIcon, type PatientIconKey } from './icons';

interface Tab {
  href: string;
  label: string;
  icon: PatientIconKey;
}

const TABS: Tab[] = [
  { href: '/app/patient',              label: 'Home',    icon: 'home' },
  { href: '/app/patient/timeline',     label: 'Journey', icon: 'timeline' },
  { href: '/app/patient/tasks',        label: 'Prep',    icon: 'tasks' },
  { href: '/app/patient/messages',     label: 'Chat',    icon: 'msg' },
  { href: '/app/patient/profile',      label: 'Me',      icon: 'me' },
];

export function PatientShell({ children, time = '9:41' }: { children: React.ReactNode; time?: string }) {
  const pathname = usePathname();

  return (
    <div className="pwa-stage">
      <div className="pwa-device">
        <div className="pwa-screen">
          <div className="pwa-island" />
          <div className="pwa-status">
            <span>{time}</span>
            <span className="ri">
              <PatientIcon name="signal" />
              <PatientIcon name="wifi" />
              <PatientIcon name="battery" />
            </span>
          </div>

          <div className="pwa-content">{children}</div>

          <div className="pwa-tabs">
            {TABS.map((t) => {
              const active = pathname === t.href;
              return (
                <Link key={t.href} className={`pwa-tab${active ? ' active' : ''}`} href={t.href}>
                  <PatientIcon name={t.icon} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="pwa-home-bar" />
        </div>
      </div>
    </div>
  );
}
