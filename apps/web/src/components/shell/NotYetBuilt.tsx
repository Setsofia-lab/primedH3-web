/**
 * NotYetBuilt — placeholder card for shells whose backing service is
 * not yet wired. Honest about what's coming, when, and what backs it.
 *
 * Used to replace Phase-1 mock pages that we don't have time to flesh
 * out yet but want a real, navigable entry for during usability tests.
 */
import type { ReactNode } from 'react';

export interface NotYetBuiltProps {
  readonly title: string;
  readonly milestone: string;       // e.g. "Phase 2 · M9"
  readonly description: ReactNode;  // What this surface will do.
  readonly tracking?: ReactNode;    // Optional: links to ADRs / docs.
}

export function NotYetBuilt({ title, milestone, description, tracking }: NotYetBuiltProps) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <span className="status-pill" style={{ background: 'var(--surface-200)' }}>
          {milestone}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 12, padding: '8px 0' }}>
        <div className="muted">{description}</div>
        {tracking && <div className="muted" style={{ fontSize: 12 }}>{tracking}</div>}
      </div>
    </div>
  );
}
