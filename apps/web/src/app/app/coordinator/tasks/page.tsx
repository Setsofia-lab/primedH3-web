'use client';

/**
 * Coordinator · Tasks — real, cross-case task list (M7.5).
 *
 * Shows every workup task across the coordinator's facility (the api
 * scopes /tasks for non-admins by visible cases). Filterable by status
 * and assignee role; click-through to the case detail.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
type TaskAssigneeRole =
  | 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';

interface Task {
  id: string;
  caseId: string;
  title: string;
  status: TaskStatus;
  assigneeRole: TaskAssigneeRole;
  assigneeUserId: string | null;
  dueDate: string | null;
  createdAt: string;
}
interface CaseRow { id: string; patientId: string; }
interface Patient { id: string; firstName: string; lastName: string; }

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

const STATUS_FILTERS: Array<{ s: 'all' | 'open' | TaskStatus; label: string }> = [
  { s: 'open',        label: 'Open' },
  { s: 'all',         label: 'All' },
  { s: 'pending',     label: 'Pending' },
  { s: 'in_progress', label: 'In progress' },
  { s: 'blocked',     label: 'Blocked' },
  { s: 'done',        label: 'Done' },
];

const ROLE_FILTERS: Array<'all' | TaskAssigneeRole> = [
  'all', 'coordinator', 'surgeon', 'anesthesia', 'allied', 'patient',
];

export default function CoordinatorTasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [casesById, setCasesById] = useState<Map<string, CaseRow>>(new Map());
  const [patientsById, setPatientsById] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | 'open' | TaskStatus>('open');
  const [role, setRole] = useState<'all' | TaskAssigneeRole>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [t, c, p] = await Promise.all([
        jsonOrThrow<{ items: Task[] }>(await fetch('/api/tasks?limit=200')),
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
      ]);
      setTasks(t.items);
      const cm = new Map<string, CaseRow>();
      c.items.forEach((x) => cm.set(x.id, x));
      setCasesById(cm);
      const pm = new Map<string, Patient>();
      p.items.forEach((x) => pm.set(x.id, x));
      setPatientsById(pm);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    if (!tasks) return [];
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (status === 'open') {
        if (t.status === 'done') return false;
      } else if (status !== 'all' && t.status !== status) return false;
      if (role !== 'all' && t.assigneeRole !== role) return false;
      if (!q) return true;
      const c = casesById.get(t.caseId);
      const p = c ? patientsById.get(c.patientId) : null;
      return [t.title, p?.firstName, p?.lastName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [tasks, status, role, query, casesById, patientsById]);

  async function setStatusFor(t: Task, next: TaskStatus) {
    setBusyId(t.id);
    try {
      await jsonOrThrow(
        await fetch(`/api/tasks/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        }),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell breadcrumbs={['Coordinator', 'Tasks']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Tasks</span>
          <h1>Workup &amp; <span className="emph">follow-ups</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
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
            placeholder="Search task or patient"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          style={{ width: 160 }}
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>{r === 'all' ? 'all roles' : r}</option>
          ))}
        </select>
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length} task{rows.length === 1 ? '' : 's'}</span>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!tasks ? (
        <div className="muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="muted">No tasks match.</div></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Patient</th>
              <th>Role</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const c = casesById.get(t.caseId);
              const p = c ? patientsById.get(c.patientId) : null;
              const overdue = t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date();
              return (
                <tr key={t.id}>
                  <td>
                    <div className="cell-primary">{t.title}</div>
                    <div className="cell-sub">created {new Date(t.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td>
                    {c ? (
                      <Link href={`/app/admin/cases/${c.id}`} style={{ textDecoration: 'underline' }}>
                        {p ? `${p.firstName} ${p.lastName}` : c.id.slice(0, 8)}
                      </Link>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td><span className={`role-pill role-${t.assigneeRole}`}>{t.assigneeRole}</span></td>
                  <td style={{ color: overdue ? 'var(--danger, #c0392b)' : undefined }}>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td><span className={`status-pill ${t.status}`}>{t.status}</span></td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => void setStatusFor(t, e.target.value as TaskStatus)}
                      disabled={busyId === t.id}
                      style={{
                        fontSize: 12,
                        padding: '4px 6px',
                        border: '1px solid var(--border, #eaeaea)',
                        borderRadius: 4,
                      }}
                    >
                      <option value="pending">pending</option>
                      <option value="in_progress">in progress</option>
                      <option value="done">done</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
