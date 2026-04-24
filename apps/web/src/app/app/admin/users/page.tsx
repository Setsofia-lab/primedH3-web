'use client';

/**
 * Admin · Users — real data, replaces the Phase-1 mock.
 *
 * Lists everyone with login access (rows in `users` table, populated
 * by either the auto-bootstrap on first auth or the invite endpoint).
 * "Invite user" creates a Cognito user in the right pool, sends them
 * an email with a temporary password, and creates a DB row linked by
 * cognito_sub.
 */
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';
  cognitoSub: string | null;
  cognitoPool: string | null;
  cognitoGroups: string[];
  facilityId: string | null;
  invitedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

interface Facility {
  id: string;
  name: string;
}

const ROLE_OPTIONS: User['role'][] = [
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied',
  'admin',
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<User['role'] | 'all'>('all');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [iEmail, setIEmail] = useState('');
  const [iFirst, setIFirst] = useState('');
  const [iLast, setILast] = useState('');
  const [iRole, setIRole] = useState<User['role']>('surgeon');
  const [iFacility, setIFacility] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [u, f] = await Promise.all([
        jsonOrThrow<{ items: User[] }>(await fetch('/api/admin/users?limit=200')),
        jsonOrThrow<Facility[]>(await fetch('/api/admin/facilities')),
      ]);
      setUsers(u.items);
      setFacilities(f);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    try {
      const body = {
        email: iEmail.trim(),
        firstName: iFirst.trim(),
        lastName: iLast.trim(),
        role: iRole,
        ...(iFacility ? { facilityId: iFacility } : {}),
      };
      const r = await jsonOrThrow<{ user: User; userStatus: string }>(
        await fetch('/api/admin/users/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      setInviteResult(
        `Invited ${r.user.email} (${r.user.role}). Cognito status: ${r.userStatus}. They'll receive an email with a temporary password.`,
      );
      setIEmail('');
      setIFirst('');
      setILast('');
      await load();
    } catch (e) {
      setInviteResult(`Error: ${(e as Error).message}`);
    } finally {
      setInviting(false);
    }
  }

  const filtered = users?.filter((u) => filter === 'all' || u.role === filter) ?? [];

  return (
    <AppShell breadcrumbs={['Admin', 'Users']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Users</span>
          <h1>People with <span className="emph">access</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setInviteOpen((v) => !v)}>
            {inviteOpen ? 'Close' : 'Invite user'}
          </button>
        </div>
      </div>

      {inviteOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><h3>Invite a user</h3></div>
          <form onSubmit={submitInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 720 }}>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Email</div>
              <input className="input" type="email" required value={iEmail} onChange={(e) => setIEmail(e.target.value)} />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Role</div>
              <select className="input" value={iRole} onChange={(e) => setIRole(e.target.value as User['role'])}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>First name</div>
              <input className="input" required value={iFirst} onChange={(e) => setIFirst(e.target.value)} />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 4 }}>Last name</div>
              <input className="input" required value={iLast} onChange={(e) => setILast(e.target.value)} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <div className="muted" style={{ marginBottom: 4 }}>Facility (optional)</div>
              <select className="input" value={iFacility} onChange={(e) => setIFacility(e.target.value)}>
                <option value="">—</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-primary" type="submit" disabled={inviting}>
                {inviting ? 'Inviting…' : 'Send invite'}
              </button>
            </div>
          </form>
          {inviteResult && (
            <div className="muted" style={{ marginTop: 12 }}>{inviteResult}</div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Users {filtered.length > 0 && `(${filtered.length})`}</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', ...ROLE_OPTIONS] as Array<'all' | User['role']>).map((r) => (
              <button
                key={r}
                className={`btn ${filter === r ? 'btn-primary' : 'btn-outline-dark'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {error && <div style={{ color: 'var(--danger, #c0392b)' }}>{error}</div>}
        {!users ? (
          <div className="muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="muted">No users yet. Click "Invite user" to add one.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Pool</th>
                <th>Last seen</th>
                <th>Invited</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>{u.lastName}, {u.firstName}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-pill role-${u.role}`}>{u.role}</span></td>
                  <td className="muted">{u.cognitoPool ?? '—'}</td>
                  <td className="muted">{timeAgo(u.lastSeenAt)}</td>
                  <td className="muted">{u.invitedAt ? new Date(u.invitedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
