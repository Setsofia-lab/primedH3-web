'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';
import { USERS, type UserRole } from '@/mocks/fixtures/admin';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  surgeon: 'Surgeon',
  anesthesia: 'Anesthesiologist',
  coordinator: 'Coordinator',
};

const COUNTS = USERS.reduce<Record<UserRole | 'all', number>>(
  (acc, u) => {
    acc.all += 1;
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  },
  { all: 0, admin: 0, surgeon: 0, anesthesia: 0, coordinator: 0 },
);

const ROLE_FILTERS: Array<{ r: UserRole | 'all'; label: string }> = [
  { r: 'all',         label: `All · ${COUNTS.all}` },
  { r: 'admin',       label: `Admin · ${COUNTS.admin}` },
  { r: 'surgeon',     label: `Surgeons · ${COUNTS.surgeon}` },
  { r: 'anesthesia',  label: `Anesthesia · ${COUNTS.anesthesia}` },
  { r: 'coordinator', label: `Coordinators · ${COUNTS.coordinator}` },
];

export default function AdminUsersPage() {
  const [role, setRole] = useState<UserRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return USERS.filter(
      (u) =>
        (role === 'all' || u.role === role) &&
        (q === '' || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    );
  }, [role, query]);

  return (
    <AppShell breadcrumbs={['Admin', 'Users']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Users</span>
          <h1>
            People with <span className="emph">access</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">Export CSV</button>
          <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            Invite user
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.r}
              type="button"
              className={role === f.r ? 'active' : undefined}
              onClick={() => setRole(f.r)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mini-search">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} user{rows.length === 1 ? '' : 's'}</span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Email</th>
            <th>Cases</th>
            <th>Last active</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="row-with-avatar">
                  <span className="avatar-xs">{u.initials}</span>
                  <div>
                    <div className="cell-primary">{u.name}</div>
                    <div className="cell-sub">{u.id}</div>
                  </div>
                </div>
              </td>
              <td>
                {ROLE_LABEL[u.role]}
                <div className="cell-sub">{u.roleLabel}</div>
              </td>
              <td>{u.email}</td>
              <td>{u.cases ?? '—'}</td>
              <td>{u.lastActive}</td>
              <td>
                <span className={`status-pill ${u.status}`}>{u.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Invite slideover */}
      <div
        className={`slideover-overlay${inviteOpen ? ' open' : ''}`}
        onClick={() => setInviteOpen(false)}
      />
      <aside
        className={`slideover${inviteOpen ? ' open' : ''}`}
        aria-hidden={!inviteOpen}
      >
        <div className="so-head">
          <h2>Invite a user</h2>
          <button className="close-x" type="button" onClick={() => setInviteOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="so-body">
          <div className="ai-banner"><b>Sandbox</b> · invitations are simulated — no email is sent.</div>
          <div className="field-grid">
            <div className="field"><label>First name</label><input type="text" placeholder="Dana" /></div>
            <div className="field"><label>Last name</label><input type="text" placeholder="Lima" /></div>
          </div>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Work email</label>
            <input type="email" placeholder="d.lima@bayview.demo" />
          </div>
          <div className="field-grid">
            <div className="field">
              <label>Role</label>
              <select defaultValue="Care coordinator">
                <option>Care coordinator</option>
                <option>Surgeon</option>
                <option>Anesthesiologist</option>
                <option>Health-center admin</option>
              </select>
            </div>
            <div className="field">
              <label>Service line</label>
              <select defaultValue="General">
                <option>General</option>
                <option>Orthopedics</option>
                <option>ENT</option>
                <option>—</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Note to invitee</label>
            <textarea rows={3} placeholder="Welcome to PrimedHealth — your account is ready." />
          </div>
        </div>
        <div className="so-foot">
          <button className="btn btn-ghost" onClick={() => setInviteOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => setInviteOpen(false)}>Send invite</button>
        </div>
      </aside>
    </AppShell>
  );
}
