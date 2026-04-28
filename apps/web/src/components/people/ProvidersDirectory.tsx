'use client';

/**
 * Shared "Referral network" providers directory used by
 * /app/admin/providers and /app/coordinator/providers. The two routes
 * are required to render pixel-identical UI. Coordinator + admin both
 * see the facility-scoped people directory.
 *
 * Visual matches the Phase-1 reference: a 3-col grid of provider
 * cards, each with avatar circle, name, role-derived specialty +
 * facility, and a stat line. The data is real and comes from
 * /api/providers (slim, role-pool aware).
 */
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

type Role = 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied';
interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function initials(first: string, last: string): string {
  const f = (first || '').trim()[0] ?? '';
  const l = (last || '').trim()[0] ?? '';
  return (f + l || '?').toUpperCase();
}

const ROLE_FILTERS: Array<{ r: 'all' | Role; label: string }> = [
  { r: 'all', label: 'All' },
  { r: 'surgeon', label: 'Surgeons' },
  { r: 'anesthesia', label: 'Anesthesia' },
  { r: 'coordinator', label: 'Coordinators' },
  { r: 'allied', label: 'Allied' },
  { r: 'admin', label: 'Admins' },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Health-center admin',
  surgeon: 'Surgery',
  anesthesia: 'Anesthesia',
  coordinator: 'Care coordinator',
  allied: 'Allied health',
};

export interface ProvidersDirectoryProps {
  /** Crumbs for the AppShell topbar — e.g. ['Admin', 'Providers']. */
  breadcrumbs: string[];
  /** Eyebrow line above the H1, e.g. 'Coordinator · Providers'. */
  eyebrow: string;
}

export function ProvidersDirectory({ breadcrumbs, eyebrow }: ProvidersDirectoryProps) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Role>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await jsonOrNull<{ items: Provider[] }>(await fetch('/api/providers'));
        setProviders(res?.items ?? []);
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
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>
            Referral <span className="emph">network</span>.
          </h1>
        </div>
      </div>

      <div className="ai-banner">
        <b>ReferralAgent</b> picks the best-responding specialist based on SLA history and
        distance. Response times tracked automatically.
      </div>

      <div className="toolbar">
        <div className="seg">
          {ROLE_FILTERS.map((r) => (
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
        <div className="providers-grid">
          {rows.map((p) => {
            const honorific = p.role === 'surgeon' || p.role === 'anesthesia' ? 'Dr. ' : '';
            return (
              <div className="provider-card" key={p.id}>
                <span className="avatar">{initials(p.firstName, p.lastName)}</span>
                <div className="meta">
                  <div className="nm">{honorific}{p.firstName} {p.lastName}</div>
                  <div className="sub">{ROLE_LABEL[p.role]}</div>
                  <div className="sub-mono">
                    <span className={`role-pill role-${p.role}`}>{p.role}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .providers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1rem;
        }
        .provider-card {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
          background: var(--surface-0);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1rem 1.125rem;
          transition: border-color 0.15s ease;
        }
        .provider-card:hover {
          border-color: var(--primary-blue);
        }
        .provider-card .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary-blue);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 0.8125rem;
          font-weight: 600;
          flex-shrink: 0;
        }
        .provider-card .meta {
          flex: 1;
          min-width: 0;
        }
        .provider-card .nm {
          font-weight: 600;
          color: var(--ink-900);
          font-size: 0.9375rem;
        }
        .provider-card .sub {
          font-size: 0.8125rem;
          color: var(--ink-500);
          margin-top: 2px;
        }
        .provider-card .sub-mono {
          margin-top: 0.5rem;
        }
      `}</style>
    </AppShell>
  );
}
