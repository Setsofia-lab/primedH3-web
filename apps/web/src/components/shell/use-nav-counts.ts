'use client';

/**
 * useNavCounts — fetches live counts for sidebar badges.
 *
 * One round-trip on mount; reused across the sidebar via a cached
 * window-level promise so a tab change doesn't re-fetch. Keys match
 * NavItem.key in nav.ts; missing keys → no badge (sidebar treats
 * undefined as "don't render a count").
 */
import { useEffect, useState } from 'react';
import type { Role } from '@/types/session';

export type NavCounts = Partial<Record<string, number>>;

let cached: { at: number; counts: NavCounts } | null = null;
const TTL_MS = 30_000;

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function loadFor(role: Role): Promise<NavCounts> {
  if (role === 'admin') {
    const [c, u] = await Promise.all([
      jsonOrNull<{ items: unknown[] }>(await fetch('/api/admin/cases?limit=200')),
      jsonOrNull<{ items: unknown[] }>(await fetch('/api/admin/users?limit=200')),
    ]);
    return {
      cases: c?.items.length,
      users: u?.items.length,
    };
  }
  if (role === 'surgeon') {
    const [c, t] = await Promise.all([
      jsonOrNull<{ items: unknown[] }>(await fetch('/api/cases?limit=200')),
      jsonOrNull<{ items: { status: string }[] }>(
        await fetch('/api/tasks?mine=true&limit=200'),
      ),
    ]);
    return {
      cases: c?.items.length,
      tasks: t?.items.filter((x) => x.status !== 'done').length,
    };
  }
  if (role === 'coordinator' || role === 'allied') {
    const [c, t] = await Promise.all([
      jsonOrNull<{ items: unknown[] }>(await fetch('/api/cases?limit=200')),
      jsonOrNull<{ items: { status: string }[] }>(await fetch('/api/tasks?limit=500')),
    ]);
    return {
      board: c?.items.length,
      tasks: t?.items.filter((x) => x.status !== 'done').length,
    };
  }
  if (role === 'anesthesia') {
    const queue = await jsonOrNull<{ items: unknown[] }>(await fetch('/api/cases?limit=200'));
    return {
      queue: queue?.items.length,
    };
  }
  return {};
}

export function useNavCounts(role: Role): NavCounts {
  const [counts, setCounts] = useState<NavCounts>(() =>
    cached && Date.now() - cached.at < TTL_MS ? cached.counts : {},
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const fresh = await loadFor(role);
      if (!alive) return;
      cached = { at: Date.now(), counts: fresh };
      setCounts(fresh);
    })();
    return () => {
      alive = false;
    };
  }, [role]);

  return counts;
}
