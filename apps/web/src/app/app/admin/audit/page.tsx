'use client';

/**
 * Admin · Audit log — real, paginated event stream.
 *
 * Filters: action verb, resource type, since (preset windows). Events
 * are append-only on the server; this page is read-only.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

type AuditAction =
  | 'create' | 'update' | 'delete' | 'read'
  | 'login' | 'invite' | 'hydrate' | 'sign';

interface AuditEvent {
  id: string;
  occurredAt: string;
  actorEmail: string | null;
  actorRole: string | null;
  actorPool: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  targetFacilityId: string | null;
  requestId: string | null;
  ip: string | null;
  beforeJson: unknown;
  afterJson: unknown;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

const ACTION_FILTERS: Array<'all' | AuditAction> = [
  'all', 'create', 'update', 'delete', 'invite', 'hydrate', 'sign',
];

const SINCE_OPTIONS: Array<{ k: string; label: string; ms: number | null }> = [
  { k: '1h',  label: 'Last hour',   ms: 1 * 3600 * 1000 },
  { k: '24h', label: 'Last 24h',    ms: 24 * 3600 * 1000 },
  { k: '7d',  label: 'Last 7 days', ms: 7 * 24 * 3600 * 1000 },
  { k: 'all', label: 'All time',    ms: null },
];

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'all' | AuditAction>('all');
  const [since, setSince] = useState<string>('24h');
  const [resourceType, setResourceType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (action !== 'all') params.set('action', action);
      const window = SINCE_OPTIONS.find((s) => s.k === since);
      if (window?.ms) params.set('since', new Date(Date.now() - window.ms).toISOString());
      if (resourceType) params.set('resourceType', resourceType);
      const r = await jsonOrThrow<{ items: AuditEvent[] }>(
        await fetch(`/api/admin/audit?${params.toString()}`),
      );
      setEvents(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [action, since, resourceType]);

  const resourceTypes = useMemo(() => {
    const set = new Set<string>();
    events?.forEach((e) => set.add(e.resourceType));
    return Array.from(set).sort();
  }, [events]);

  return (
    <AppShell breadcrumbs={['Admin', 'Audit log']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Audit log</span>
          <h1>Every privileged action, <span className="emph">searchable</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {ACTION_FILTERS.map((a) => (
            <button
              key={a}
              type="button"
              className={action === a ? 'active' : undefined}
              onClick={() => setAction(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <select
          className="input"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          style={{ width: 160 }}
        >
          {SINCE_OPTIONS.map((s) => (
            <option key={s.k} value={s.k}>{s.label}</option>
          ))}
        </select>
        <select
          className="input"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">all resources</option>
          {resourceTypes.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="spacer" />
        <span className="status-pill neutral">{events?.length ?? 0} events</span>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!events ? (
        <div className="muted">Loading…</div>
      ) : events.length === 0 ? (
        <div className="card"><div className="muted">No events match.</div></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Resource id</th>
              <th>IP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const open = expanded === e.id;
              return (
                <>
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(open ? null : e.id)}>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {new Date(e.occurredAt).toLocaleString()}
                    </td>
                    <td>
                      {e.actorEmail ?? '—'}
                      {e.actorRole && (
                        <span className={`role-pill role-${e.actorRole}`} style={{ marginLeft: 6, fontSize: 11 }}>
                          {e.actorRole}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill audit-${e.action}`} style={{ fontSize: 11 }}>{e.action}</span>
                    </td>
                    <td>{e.resourceType}</td>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {e.resourceId ? e.resourceId.slice(0, 12) : '—'}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{e.ip ?? '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{open ? '▼' : '▶'}</td>
                  </tr>
                  {open && (
                    <tr key={`${e.id}-detail`}>
                      <td colSpan={7} style={{ background: 'var(--surface-50, #fafafa)', padding: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                          <div>
                            <div className="muted" style={{ marginBottom: 4 }}>before</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {e.beforeJson ? JSON.stringify(e.beforeJson, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div className="muted" style={{ marginBottom: 4 }}>after</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {e.afterJson ? JSON.stringify(e.afterJson, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                        {e.requestId && (
                          <div className="muted" style={{ marginTop: 12, fontSize: 11 }}>
                            request-id: <code>{e.requestId}</code>
                            {e.resourceId && <> · full resource-id: <code>{e.resourceId}</code></>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
