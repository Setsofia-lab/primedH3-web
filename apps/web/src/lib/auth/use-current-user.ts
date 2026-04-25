'use client';

/**
 * useCurrentUser — fetches the real authenticated user via /api/auth/me.
 *
 * The Sidebar / Topbar consumed a Phase-1 mock identity store; once
 * Cognito went live, that store is stale and shows the wrong name.
 * This hook is the bridge: any client component that wants the live
 * user's name + role calls this and renders from the result.
 *
 * Cached on `window` so the hook is cheap on every page.
 */
import { useEffect, useState } from 'react';
import type { Role, Pool } from '@/types/session';

export interface CurrentUser {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  pool: Pool;
  role: Role;
  groups: readonly string[];
  expiresAt: number;
}

declare global {
  interface Window {
    __primedCurrentUser?: { at: number; user: CurrentUser | null };
  }
}

const TTL_MS = 60_000;

async function fetchMe(): Promise<CurrentUser | null> {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json()) as { authenticated?: boolean } & Partial<CurrentUser>;
  if (!body.authenticated) return null;
  return {
    sub: body.sub ?? '',
    email: body.email ?? '',
    firstName: body.firstName ?? '',
    lastName: body.lastName ?? '',
    pool: body.pool as Pool,
    role: body.role as Role,
    groups: body.groups ?? [],
    expiresAt: body.expiresAt ?? 0,
  };
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const c = window.__primedCurrentUser;
    if (c && Date.now() - c.at < TTL_MS) return c.user;
    return null;
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const u = await fetchMe();
      if (!alive) return;
      window.__primedCurrentUser = { at: Date.now(), user: u };
      setUser(u);
    })();
    return () => { alive = false; };
  }, []);

  return user;
}
