'use client';

/**
 * Coordinator · Providers — directory of providers visible to the caller
 * (facility-scoped). Sourced from the slim /api/providers endpoint.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied';
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

const ROLES: Array<{ r: 'all' | Provider['role']; label: string }> = [
  { r: 'all', label: 'All' },
  { r: 'surgeon', label: 'Surgeons' },
  { r: 'anesthesia', label: 'Anesthesia' },
  { r: 'coordinator', label: 'Coordinators' },
  { r: 'allied', label: 'Allied' },
  { r: 'admin', label: 'Admins' },
];

export default function CoordinatorProvidersPage() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Provider['role']>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await jsonOrThrow<{ items: Provider[] }>(await fetch('/api/providers'));
        setProviders(res.items);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!providers) return [];
    const q = query.trim().toLowerCase();
    return providers.filter((p) => {
      if (filter !== 'all' && p.role !== filter) return false;
      if (!q) return true;
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
    });
  }, [providers, filter, query]);

  return (
    <AppShell breadcrumbs={['Coordinator', 'Providers']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Providers</span>
          <h1>People at <span className="emph">your facility</span>.</h1>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {ROLES.map((r) => (
            <button
              key={r.r}
              type="button"
              className={filter === r.r ? 'active' : undefined}
              onClick={() => setFilter(r.r)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="mini-search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length}</span>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!providers ? (
        <div className="muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="muted">No matches.</div></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.role === 'surgeon' || p.role === 'anesthesia' ? 'Dr. ' : ''}
                  {p.lastName}, {p.firstName}
                </td>
                <td><span className={`role-pill role-${p.role}`}>{p.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
