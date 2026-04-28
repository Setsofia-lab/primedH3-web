'use client';

/**
 * Admin · Dashboard — KPIs + live agent activity stream.
 */
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AgentActivityCard } from '@/components/agents/AgentActivityCard';

interface CaseRow { status: string; readinessScore: number | null; }
interface User { firstName: string; lastName: string; }

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export default function AdminDashboardPage() {
  const [me, setMe] = useState<User | null>(null);
  const [counts, setCounts] = useState<{
    cases: number;
    patients: number;
    users: number;
    avgReadiness: number | null;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const meRes = await jsonOrNull<{ firstName: string; lastName: string }>(await fetch('/api/auth/me'));
      if (meRes) setMe(meRes);
      const [c, p, u] = await Promise.all([
        jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/admin/cases?limit=200')),
        jsonOrNull<{ items: unknown[] }>(await fetch('/api/admin/patients?limit=200')),
        jsonOrNull<{ items: unknown[] }>(await fetch('/api/admin/users?limit=200')),
      ]);
      const cases = c?.items ?? [];
      const scored = cases.filter((x) => typeof x.readinessScore === 'number');
      setCounts({
        cases: cases.length,
        patients: p?.items.length ?? 0,
        users: u?.items.length ?? 0,
        avgReadiness:
          scored.length > 0
            ? Math.round(
                scored.reduce((a, x) => a + (x.readinessScore ?? 0), 0) / scored.length,
              )
            : null,
      });
    })();
  }, []);

  return (
    <AppShell breadcrumbs={['Admin', 'Dashboard']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Dashboard</span>
          <h1>
            {me ? (
              <>Welcome back, <span className="emph">{me.firstName}</span>.</>
            ) : (
              <>Welcome <span className="emph">back</span>.</>
            )}
          </h1>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline-dark" href="/app/admin/athena">Hydrate patient</a>
          <a className="btn btn-primary" href="/app/admin/users">Invite user</a>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi blue">
          <div className="lbl">Active cases</div>
          <div className="val">{counts?.cases ?? '—'}</div>
          <div className="delta">across all facilities</div>
        </div>
        <div className="kpi">
          <div className="lbl">Mirrored patients</div>
          <div className="val">{counts?.patients ?? '—'}</div>
          <div className="delta">from Athena</div>
        </div>
        <div className="kpi">
          <div className="lbl">Users</div>
          <div className="val">{counts?.users ?? '—'}</div>
          <div className="delta">with login access</div>
        </div>
        <div className="kpi">
          <div className="lbl">Avg readiness</div>
          <div className="val">
            {counts?.avgReadiness ?? '—'}
            {counts?.avgReadiness != null && <span style={{ fontSize: '1.25rem', color: 'var(--ink-500)' }}>%</span>}
          </div>
          <div className="delta">scored cases only</div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <AgentActivityCard source="admin" title="Live agent activity" limit={15} />
      </div>
    </AppShell>
  );
}
