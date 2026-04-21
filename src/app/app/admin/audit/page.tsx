'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';
import { AUDIT, type AuditActorType } from '@/mocks/fixtures/admin';

const ACTOR_FILTERS: Array<{ k: 'all' | AuditActorType; label: string }> = [
  { k: 'all',   label: 'All actors' },
  { k: 'agent', label: 'Agents only' },
  { k: 'human', label: 'Humans only' },
];

function fmtTs(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function pillForResult(result: string) {
  if (result === 'approved' || result === 'delivered' || result === 'sent') return 'approved';
  if (result === 'pending_review' || result === 'awaiting_fax') return 'pending';
  return 'neutral';
}

export default function AdminAuditPage() {
  const [actor, setActor] = useState<'all' | AuditActorType>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return AUDIT.filter(
      (e) =>
        (actor === 'all' || e.actorType === actor) &&
        (q === '' ||
          e.actor.toLowerCase().includes(q) ||
          e.action.includes(q) ||
          e.target.toLowerCase().includes(q)),
    );
  }, [actor, query]);

  return (
    <AppShell breadcrumbs={['Admin', 'Audit log']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Audit log</span>
          <h1>
            Append-only <span className="emph">record</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">Export JSON</button>
        </div>
      </div>

      <div className="ai-banner">
        <b>Immutable</b> · every agent action + human sign-off is recorded with timestamp, actor,
        target, and result. SOC2-shaped schema, ready for Phase 3 CloudTrail sink.
      </div>

      <div className="toolbar">
        <div className="seg">
          {ACTOR_FILTERS.map((f) => (
            <button
              key={f.k}
              type="button"
              className={actor === f.k ? 'active' : undefined}
              onClick={() => setActor(f.k)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mini-search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search actor, action, target"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} event{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card audit-stream" style={{ padding: 0 }}>
        {rows.map((e, i) => (
          <div className="row" key={`${e.ts}-${i}`}>
            <div className="ts">{fmtTs(e.ts)}</div>
            <div className="act">
              <b>{e.actor}</b> <span className="action">{e.action}</span>{' '}
              <span style={{ color: 'var(--ink-500)' }}>on</span>{' '}
              <code>{e.target}</code>
            </div>
            <div className="by">
              <span className={`kind ${e.actorType}`}>{e.actorType}</span>
              <span className={`status-pill ${pillForResult(e.result)}`}>{e.result.replace(/_/g, ' ')}</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
