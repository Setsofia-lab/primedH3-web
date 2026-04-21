'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';
import { PATIENTS, type CaseStatus } from '@/mocks/fixtures/admin';

const STATUS_FILTERS: Array<{ s: 'all' | CaseStatus; label: string }> = [
  { s: 'all', label: 'All' },
  { s: 'cleared', label: 'Cleared' },
  { s: 'conditional', label: 'Conditional' },
  { s: 'workup', label: 'In workup' },
  { s: 'deferred', label: 'Deferred' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function daysTo(d: string) {
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000));
}

export default function SurgeonCasesPage() {
  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return PATIENTS.filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (q === '' || p.name.toLowerCase().includes(q) || p.procedure.toLowerCase().includes(q)),
    ).sort((a, b) => a.readiness - b.readiness);
  }, [status, query]);

  return (
    <AppShell breadcrumbs={['Surgeon', 'My cases']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Dr. Oduya</span>
          <h1>
            My <span className="emph">cases</span>.
          </h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline-dark" href="/app/surgeon/schedule">Schedule</Link>
          <Link className="btn btn-primary" href="/app/surgeon/new">New case</Link>
        </div>
      </div>

      <div className="kpi-mini">
        <div className="k"><div className="l">Open cases</div><div className="v">24</div></div>
        <div className="k"><div className="l">Ready for OR</div><div className="v">7</div></div>
        <div className="k"><div className="l">Awaiting sign-off</div><div className="v">5</div></div>
        <div className="k"><div className="l">Next surgery</div><div className="v">Apr 28</div></div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.s}
              type="button"
              className={status === f.s ? 'active' : undefined}
              onClick={() => setStatus(f.s)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mini-search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search patient or procedure"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} case{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {rows.map((p) => (
          <Link className="case-card" href={`/app/surgeon/cases/${p.id}`} key={p.id}>
            <div className="av">{p.initials}</div>
            <div>
              <div className="nm">
                {p.name} <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}>· {p.age}y</span>
              </div>
              <div className="sub">
                {p.procedure} · CPT {p.procedureCode}
              </div>
            </div>
            <div className="readiness-bar" style={{ minWidth: 140 }}>
              <div className="track">
                <div className="fill" style={{ width: `${p.readiness}%` }} />
              </div>
              <div className="val">{p.readiness}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
              <span className={`status-pill ${p.status}`}>{p.status}</span>
              <div className="date">
                {fmtDate(p.surgeryDate)}
                <span className="d">IN {daysTo(p.surgeryDate)} DAYS</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
