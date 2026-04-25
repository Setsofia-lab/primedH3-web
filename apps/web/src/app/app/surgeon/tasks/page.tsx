'use client';

/**
 * Surgeon · Sign-offs — tasks assigned to the surgeon role on cases
 * the current user owns. ?mine=true scopes to "assigned to me OR
 * unclaimed but for my role".
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/shell/icons';

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

interface Task {
  id: string;
  caseId: string;
  title: string;
  status: TaskStatus;
  assigneeRole: string;
  dueDate: string | null;
  createdAt: string;
}
interface CaseRow { id: string; patientId: string; surgeryDate: string | null; }
interface Patient { id: string; firstName: string; lastName: string; }

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

const TABS: Array<{ k: 'open' | 'done'; label: string }> = [
  { k: 'open', label: 'Open' },
  { k: 'done', label: 'Completed' },
];

export default function SurgeonTasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [casesById, setCasesById] = useState<Map<string, CaseRow>>(new Map());
  const [patientsById, setPatientsById] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [t, c, p] = await Promise.all([
        jsonOrThrow<{ items: Task[] }>(await fetch('/api/tasks?mine=true&limit=200')),
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=500')),
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
      const isDone = t.status === 'done';
      if (tab === 'open' && isDone) return false;
      if (tab === 'done' && !isDone) return false;
      if (!q) return true;
      const c = casesById.get(t.caseId);
      const p = c ? patientsById.get(c.patientId) : null;
      return [t.title, p?.firstName, p?.lastName].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [tasks, tab, query, casesById, patientsById]);

  async function markDone(t: Task) {
    setBusyId(t.id);
    try {
      await jsonOrThrow(
        await fetch(`/api/tasks/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: t.status === 'done' ? 'pending' : 'done' }),
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
    <AppShell breadcrumbs={['Surgeon', 'Sign-offs']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Sign-offs</span>
          <h1>Pending <span className="emph">sign-offs</span>.</h1>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {TABS.map((f) => (
            <button
              key={f.k}
              type="button"
              className={tab === f.k ? 'active' : undefined}
              onClick={() => setTab(f.k)}
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
        <div className="spacer" />
        <span className="status-pill neutral">{rows.length}</span>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!tasks ? (
        <div className="muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="muted">
            {tab === 'open' ? 'No open sign-offs.' : 'No completed sign-offs.'}
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Patient</th>
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
                    <div className="cell-sub">{t.assigneeRole}</div>
                  </td>
                  <td>
                    {c ? (
                      <Link href={`/app/surgeon/cases/${c.id}`} style={{ textDecoration: 'underline' }}>
                        {p ? `${p.firstName} ${p.lastName}` : c.id.slice(0, 8)}
                      </Link>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td style={{ color: overdue ? 'var(--danger, #c0392b)' : undefined }}>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td><span className={`status-pill ${t.status}`}>{t.status}</span></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '4px 12px' }}
                      disabled={busyId === t.id}
                      onClick={() => void markDone(t)}
                    >
                      {t.status === 'done' ? 'Reopen' : 'Sign'}
                    </button>
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
