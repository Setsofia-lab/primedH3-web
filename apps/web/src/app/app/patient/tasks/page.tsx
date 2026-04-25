'use client';

/**
 * Patient · Prep — real task list. The patient toggles status; status
 * transitions are server-authoritative (PATCH /tasks/:id) so the
 * coordinator's view stays in sync.
 */
import { useEffect, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  dueDate: string | null;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export default function PatientTasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await jsonOrThrow<{ items: Task[] }>(await fetch('/api/me/tasks'));
      setTasks(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); }, []);

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

  const open = (tasks ?? []).filter((t) => t.status !== 'done');
  const done = (tasks ?? []).filter((t) => t.status === 'done');

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 12, marginTop: 0 }}>
          Your <span style={{ fontStyle: 'italic' }}>prep</span>.
        </h1>
        {error && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!tasks ? (
          <div style={{ color: '#888', fontSize: 14 }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 16, fontSize: 14, color: '#555' }}>
            No tasks for you right now.
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 8 }}>
                  To do · {open.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {open.map((t) => (
                    <TaskCard key={t.id} task={t} busy={busyId === t.id} onToggle={() => toggle(t)} />
                  ))}
                </div>
              </>
            )}
            {done.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 8 }}>
                  Completed · {done.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {done.map((t) => (
                    <TaskCard key={t.id} task={t} busy={busyId === t.id} onToggle={() => toggle(t)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PatientShell>
  );
}

function TaskCard({ task: t, busy, onToggle }: { task: Task; busy: boolean; onToggle: () => void }) {
  const isDone = t.status === 'done';
  const overdue = !isDone && t.dueDate && new Date(t.dueDate) < new Date();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        background: '#f6f7fa',
        borderRadius: 12,
        border: 'none',
        cursor: busy ? 'wait' : 'pointer',
        opacity: isDone ? 0.6 : 1,
        textAlign: 'left',
        width: '100%',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: '1.5px solid #c5cdda',
          background: isDone ? '#4B6BEF' : '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {isDone ? '✓' : ''}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            textDecoration: isDone ? 'line-through' : 'none',
            marginBottom: t.description || t.dueDate ? 2 : 0,
          }}
        >
          {t.title}
        </div>
        {t.description && (
          <div style={{ fontSize: 12, color: '#666' }}>{t.description}</div>
        )}
        {t.dueDate && (
          <div style={{ fontSize: 12, color: overdue ? '#e74c3c' : '#888' }}>
            due {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </button>
  );
}
