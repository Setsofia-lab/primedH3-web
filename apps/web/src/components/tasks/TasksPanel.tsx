'use client';

/**
 * TasksPanel — drop-in case-tasks UI.
 *
 * Used on the admin/surgeon/anesthesia case detail pages. Lists tasks
 * for a single case and lets the caller toggle status, reassign, or
 * (if `canCreate`) add a new one.
 *
 * Visibility + mutation rules are enforced server-side; this component
 * just shows what the api returns.
 */
import { useEffect, useState } from 'react';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type TaskAssigneeRole =
  | 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';

export interface Task {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeRole: TaskAssigneeRole;
  assigneeUserId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
}

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
  blocked: 'pending',
};

const ROLES: TaskAssigneeRole[] = [
  'coordinator', 'surgeon', 'anesthesia', 'allied', 'admin', 'patient',
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

interface Props {
  caseId: string;
  /** When true, show the "add task" form. */
  canCreate?: boolean;
}

export function TasksPanel({ caseId, canCreate = true }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New-task form state
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<TaskAssigneeRole>('coordinator');
  const [due, setDue] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await jsonOrThrow<{ items: Task[] }>(
        await fetch(`/api/tasks?caseId=${caseId}&limit=200`),
      );
      setTasks(res.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  async function setStatus(t: Task, status: TaskStatus) {
    setBusyId(t.id);
    try {
      await jsonOrThrow(
        await fetch(`/api/tasks/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await jsonOrThrow(
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId,
            title: title.trim(),
            assigneeRole: role,
            ...(due ? { dueDate: new Date(due).toISOString() } : {}),
          }),
        }),
      );
      setTitle(''); setDue('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Workup tasks</h3>
        {tasks && (
          <span className="status-pill neutral">
            {tasks.filter((t) => t.status === 'done').length}/{tasks.length} done
          </span>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', marginBottom: 12 }}>{error}</div>}

      {!tasks ? (
        <div className="muted">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="muted" style={{ marginBottom: 12 }}>
          No tasks yet{canCreate ? '. Add the first one below.' : '.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {tasks.map((t) => {
            const overdue = t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date();
            const isDone = t.status === 'done';
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--surface-50, #fafafa)',
                  border: '1px solid var(--border, #eaeaea)',
                  borderRadius: 8,
                  opacity: isDone ? 0.65 : 1,
                }}
              >
                <button
                  type="button"
                  aria-label={isDone ? 'Reopen' : 'Mark done'}
                  onClick={() => void setStatus(t, isDone ? 'pending' : 'done')}
                  disabled={busyId === t.id}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: '1.5px solid var(--ink-300, #c5cdda)',
                    background: isDone ? 'var(--accent, #4a4ee6)' : '#fff',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {isDone ? '✓' : ''}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}
                  >
                    {t.title}
                  </div>
                  <div className="muted" style={{ fontSize: 12, display: 'flex', gap: 8 }}>
                    <span className={`role-pill role-${t.assigneeRole}`} style={{ fontSize: 11 }}>
                      {t.assigneeRole}
                    </span>
                    {t.dueDate && (
                      <span style={{ color: overdue ? 'var(--danger, #c0392b)' : undefined }}>
                        due {new Date(t.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`status-pill ${t.status}`} style={{ fontSize: 11 }}>
                      {t.status}
                    </span>
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => void setStatus(t, e.target.value as TaskStatus)}
                  disabled={busyId === t.id}
                  style={{
                    fontSize: 12,
                    padding: '4px 6px',
                    border: '1px solid var(--border, #eaeaea)',
                    borderRadius: 4,
                    background: '#fff',
                  }}
                >
                  <option value="pending">pending</option>
                  <option value="in_progress">in progress</option>
                  <option value="done">done</option>
                  <option value="blocked">blocked</option>
                </select>
              </div>
            );
          })}
        </div>
      )}

      {canCreate && (
        <form onSubmit={submitNew} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
          <input
            className="input"
            placeholder="Task title (e.g. Order pre-op labs)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as TaskAssigneeRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={creating || !title.trim()}>
            {creating ? '…' : 'Add'}
          </button>
        </form>
      )}
    </div>
  );
}
