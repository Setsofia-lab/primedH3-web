'use client';

/**
 * Coordinator · Tasks — original M8 visual, fed by live data.
 *
 * Reads /api/tasks (server-scoped to the coordinator's visible cases),
 * /api/cases for patient lookup, /api/patients for names, and
 * /api/users for the assigned-to row. Whole row is clickable — click
 * navigates to the parent case detail (/app/admin/cases/:id) so a
 * coordinator can see the full chart, not just the task title.
 *
 * Filters mirror the original M8 segments: Open / AI-drafted / Overdue
 * / Done. AI-drafted = created_by IS NULL (the worker agent has no
 * user identity, so its inserts have null created_by).
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
type TaskAssigneeRole =
  | 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';

interface Task {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeRole: TaskAssigneeRole;
  assigneeUserId: string | null;
  dueDate: string | null;
  createdAt: string;
  createdBy: string | null;
}
interface CaseRow { id: string; patientId: string }
interface Patient { id: string; firstName: string; lastName: string }
interface User { id: string; firstName: string; lastName: string; role: string }

type FilterKey = 'open' | 'ai' | 'overdue' | 'done';
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'ai', label: 'AI-drafted' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
function fmtDue(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) {
    return `Today · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  if (same(d, tomorrow)) return 'Tomorrow';
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function initialsFor(u: User | null | undefined): string {
  if (!u) return '··';
  return ((u.firstName[0] ?? '') + (u.lastName[0] ?? '')).toUpperCase() || '··';
}

export default function CoordinatorTasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [casesById, setCasesById] = useState<Map<string, CaseRow>>(new Map());
  const [patientsById, setPatientsById] = useState<Map<string, Patient>>(new Map());
  const [usersById, setUsersById] = useState<Map<string, User>>(new Map());
  const [filter, setFilter] = useState<FilterKey>('open');
  const [error, setError] = useState<string | null>(null);
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
      setCasesById(new Map(c.items.map((x) => [x.id, x])));
      setPatientsById(new Map(p.items.map((x) => [x.id, x])));
      try {
        const u = await jsonOrThrow<{ items: User[] }>(await fetch('/api/users?limit=200'));
        setUsersById(new Map(u.items.map((x) => [x.id, x])));
      } catch {
        // 403 if endpoint not exposed — non-blocking
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    if (!tasks) return { open: 0, ai: 0, overdue: 0, done: 0 };
    const now = Date.now();
    return {
      open: tasks.filter((t) => t.status !== 'done').length,
      ai: tasks.filter((t) => t.createdBy == null).length,
      overdue: tasks.filter((t) => t.status !== 'done' && t.dueDate != null && new Date(t.dueDate).getTime() < now).length,
      done: tasks.filter((t) => t.status === 'done').length,
    };
  }, [tasks]);

  const rows = useMemo(() => {
    if (!tasks) return [];
    const now = Date.now();
    return tasks.filter((t) => {
      switch (filter) {
        case 'open': return t.status !== 'done';
        case 'ai': return t.createdBy == null;
        case 'overdue': return t.status !== 'done' && t.dueDate != null && new Date(t.dueDate).getTime() < now;
        case 'done': return t.status === 'done';
      }
    }).sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [tasks, filter]);

  async function toggle(t: Task) {
    setBusyId(t.id);
    try {
      const next = t.status === 'done' ? 'pending' : 'done';
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
          <h1>Your <span className="emph"><em>queue</em></span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? 'active' : undefined}
              onClick={() => setFilter(f.key)}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-500)' }}>
          Sort · due date
        </span>
      </div>

      <div className="ai-banner">
        <b>◆ AI-drafted tasks</b> auto-generated by agents when cases enter a new phase. You review,
        assign, and sign off — agents don&apos;t act unilaterally.
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!tasks ? (
        <div className="muted">Loading tasks…</div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="muted">No tasks match this filter.</div></div>
      ) : (
        <div className="task-list">
          {rows.map((t) => {
            const c = casesById.get(t.caseId);
            const p = c ? patientsById.get(c.patientId) : null;
            const assignee = t.assigneeUserId ? usersById.get(t.assigneeUserId) : null;
            const overdue = t.status !== 'done' && t.dueDate != null && new Date(t.dueDate).getTime() < Date.now();
            const ai = t.createdBy == null;
            return (
              <div className={`r${t.status === 'done' ? ' done' : ''}`} key={t.id}>
                {/* Checkbox toggles status — wrapped in stopPropagation so the row link doesn't fire */}
                <div
                  className="cb"
                  style={{ cursor: busyId === t.id ? 'wait' : 'pointer' }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(t); }}
                  role="button"
                  aria-label={t.status === 'done' ? 'Reopen task' : 'Mark done'}
                />
                <Link
                  href={c ? `/app/admin/cases/${c.id}` : '#'}
                  className="lbl"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div>
                    {t.title}
                    {ai && <span className="ai" style={{ marginLeft: '0.375rem' }}>◆ AI-drafted</span>}
                  </div>
                  <div className="s">
                    {p ? `${p.firstName} ${p.lastName}` : (c ? `Case ${c.id.slice(0, 8)}` : 'Unknown case')}
                    {t.description ? ` · ${t.description.length > 100 ? `${t.description.slice(0, 100)}…` : t.description}` : ''}
                  </div>
                </Link>
                <div className="as">
                  <span className="av">{initialsFor(assignee)}</span>
                  {assignee ? `${assignee.firstName} ${assignee.lastName.slice(0, 1)}.` : t.assigneeRole}
                </div>
                <div className={`due${overdue ? ' overdue' : ''}`}>{fmtDue(t.dueDate)}</div>
                <div>
                  <span className={`status-pill ${t.status === 'done' ? 'cleared' : overdue ? 'deferred' : t.status === 'blocked' ? 'cancelled' : 'pending'}`}>
                    {t.status === 'done' ? 'done' : overdue ? 'overdue' : t.status === 'in_progress' ? 'in progress' : t.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
