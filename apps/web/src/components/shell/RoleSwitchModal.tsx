'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/session';
import { Icon } from './icons';
import type { Role } from '@/types/session';

const OPTS: Array<{ role: Role; name: string; sub: string }> = [
  { role: 'admin',       name: 'Health-center admin', sub: 'KPIs, agents, audit' },
  { role: 'surgeon',     name: 'Surgeon',             sub: 'Cases and sign-offs' },
  { role: 'anesthesia',  name: 'Anesthesiologist',    sub: 'Clearance queue' },
  { role: 'coordinator', name: 'Care coordinator',    sub: 'Coordinator board' },
  { role: 'patient',     name: 'Patient (mobile PWA)', sub: 'Readiness and tasks' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RoleSwitchModal({ open, onClose }: Props) {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const setSession = useSessionStore((s) => s.setSession);
  const signOut = useSessionStore((s) => s.signOut);
  const current = session?.role;

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const pick = (r: Role) => {
    setSession(r);
    onClose();
    router.push(r === 'patient' ? '/app/patient' : `/app/${r}`);
  };

  const handleSignOut = () => {
    signOut();
    onClose();
    router.push('/login');
  };

  return (
    <div
      className="role-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="role-modal" role="dialog" aria-modal="true">
        <h2>Switch role</h2>
        <p>Pick a role to preview that surface. Real auth is wired in production; this picker is a dev shortcut.</p>
        <div className="role-list">
          {OPTS.map((o) => (
            <button
              key={o.role}
              type="button"
              data-current={o.role === current ? 'true' : undefined}
              onClick={() => pick(o.role)}
            >
              <span className="ic"><Icon name="users" /></span>
              <div>
                <div className="nm">{o.name}</div>
                <div className="sb">{o.sub}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="close-row" style={{ gap: '0.5rem' }}>
          <button className="btn btn-ghost" type="button" onClick={handleSignOut}>
            Sign out
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
