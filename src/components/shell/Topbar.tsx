'use client';

import { Icon } from './icons';

export interface TopbarProps {
  breadcrumbs?: string[];
  search?: boolean;
}

export function Topbar({ breadcrumbs = [], search = true }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="crumbs">
        {breadcrumbs.map((c, i) => {
          const last = i === breadcrumbs.length - 1;
          if (last) return <span className="curr" key={i}>{c}</span>;
          return (
            <span key={i} style={{ display: 'contents' }}>
              <span>{c}</span>
              <span className="sep">/</span>
            </span>
          );
        })}
      </div>

      {search && (
        <div className="search">
          <Icon name="search" size={14} />
          <input type="text" placeholder="Search patients, cases, agents…" />
          <span className="kbd">⌘K</span>
        </div>
      )}

      <div className="actions">
        <span className="env-pill">SANDBOX · no PHI</span>
        <button className="icon-btn" aria-label="Help" type="button">
          <Icon name="help" />
        </button>
        <button className="icon-btn" aria-label="Notifications" type="button">
          <Icon name="bell" />
          <span className="dot" />
        </button>
      </div>
    </header>
  );
}
