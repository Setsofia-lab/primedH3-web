'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/session';
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
  const session = useSessionStore((s) => s.session);
  const hydrated = useStoreHydrated();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !session) router.replace('/login');
  }, [hydrated, session, router]);

  if (!hydrated || !session) {
    // Render nothing during hydration to avoid flash; server already streams shell-less.
    return null;
  }

  // Patient PWA has its own layout (no sidebar/topbar) — handled in M9.
  if (session.role === 'patient') {
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
