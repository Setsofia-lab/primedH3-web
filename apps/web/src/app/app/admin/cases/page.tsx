'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';
import { PATIENTS, type CaseStatus } from '@/mocks/fixtures/admin';

const STATUS_FILTERS: Array<{ s: 'all' | CaseStatus; label: string }> = [
  { s: 'all',         label: 'All' },
  { s: 'cleared',     label: 'Cleared' },
  { s: 'conditional', label: 'Conditional' },
  { s: 'workup',      label: 'In workup' },
  { s: 'deferred',    label: 'Deferred' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function daysTo(d: string) {
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000));
}

export default function AdminCasesPage() {
  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return PATIENTS.filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (q === '' ||
          p.name.toLowerCase().includes(q) ||
          p.procedure.toLowerCase().includes(q) ||
          p.procedureCode.includes(q)),
    );
  }, [status, query]);

  return (
    <AppShell breadcrumbs={['Admin', 'Cases']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Cases</span>
          <h1>
            All active <span className="emph">cases</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">Filters</button>
          <button className="btn btn-outline-dark">Export CSV</button>
        </div>
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
            placeholder="Search patient, procedure, MRN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} case{rows.length === 1 ? '' : 's'}</span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Procedure</th>
            <th>Surgeon</th>
            <th>Surgery</th>
            <th>ASA</th>
            <th>Readiness</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="row-with-avatar">
                  <span className="avatar-xs">{p.initials}</span>
                  <div>
                    <div className="cell-primary">{p.name}</div>
                    <div className="cell-sub">{p.id} · age {p.age}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className="cell-primary">{p.procedure}</div>
                <div className="cell-sub">CPT {p.procedureCode}</div>
              </td>
              <td>{p.surgeon}</td>
              <td>
                {fmtDate(p.surgeryDate)}
                <div className="cell-sub">in {daysTo(p.surgeryDate)} days</div>
              </td>
              <td>ASA {p.asa}</td>
              <td>
                <div className="readiness-bar">
                  <div className="track">
                    <div className="fill" style={{ width: `${p.readiness}%` }} />
                  </div>
                  <div className="val">{p.readiness}</div>
                </div>
              </td>
              <td>
                <span className={`status-pill ${p.status}`}>{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
