'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/session';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { isDevAuthEnabled } from '@/lib/auth/cognito-config';
import { Sidebar } from './Sidebar';
import { Topbar, type TopbarProps } from './Topbar';
import { RoleSwitchModal } from './RoleSwitchModal';

interface AppShellProps extends TopbarProps {
  children: React.ReactNode;
}

/* Subscribe to Zustand persist hydration via useSyncExternalStore so we
   never call setState in an effect (React 19 strict-rule compliant). */
function useStoreHydrated() {
  return useSyncExternalStore(
    (cb) => {
      const unsub = useSessionStore.persist.onFinishHydration(cb);
      return () => unsub();
    },
    () => useSessionStore.persist.hasHydrated(),
    () => false,
  );
}

export function AppShell({ children, breadcrumbs, search }: AppShellProps) {
  const router = useRouter();
  const liveUser = useCurrentUser();
  const session = useSessionStore((s) => s.session);
  const hydrated = useStoreHydrated();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // null = haven't checked yet, true/false = decided
  const [authChecked, setAuthChecked] = useState<null | boolean>(null);

  // Real-auth gate: try /api/auth/me. If 401, send to /login. If 200, we
  // render the shell whether or not the Phase-1 zustand store has data.
  // Dev-auth mode keeps the legacy zustand check.
  useEffect(() => {
    let alive = true;
    if (isDevAuthEnabled()) {
      // Dev-auth: defer to zustand session.
      if (hydrated) {
        if (!session) router.replace('/login');
        else setAuthChecked(true);
      }
      return () => { alive = false; };
    }
    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!alive) return;
        if (res.ok) {
          setAuthChecked(true);
        } else {
          router.replace('/login');
        }
      } catch {
        if (alive) router.replace('/login');
      }
    })();
    return () => { alive = false; };
  }, [hydrated, session, router]);

  // Render nothing while we figure out auth state to avoid a flash of the
  // shell before redirecting (or before /me returns).
  if (authChecked !== true) {
    return null;
  }

  // Patient PWA has its own layout (no sidebar/topbar) — handled in M9.
  const role = liveUser?.role ?? session?.role;
  if (role === 'patient') {
    return <>{children}</>;
  }

  return (
    <div className="app">
      <Sidebar onSwitchRole={() => setSwitcherOpen(true)} />
      <div className="main">
        <Topbar breadcrumbs={breadcrumbs} search={search} />
        <div className="content">{children}</div>
      </div>
      <RoleSwitchModal open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
