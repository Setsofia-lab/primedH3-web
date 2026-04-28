'use client';

/**
 * Surgeon · Messages — inbox of cases assigned to me, sorted by most-
 * recent message. Click into a case to see the full thread.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

interface Message { id: string; caseId: string; body: string; authorRole: string; createdAt: string; }
interface CaseRow { id: string; patientId: string; }
interface Patient { id: string; firstName: string; lastName: string; }

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export default function SurgeonMessagesPage() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [casesById, setCasesById] = useState<Map<string, CaseRow>>(new Map());
  const [patientsById, setPatientsById] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [m, c, p] = await Promise.all([
        jsonOrThrow<{ items: Message[] }>(await fetch('/api/messages?limit=200')),
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
      ]);
      setMessages(m.items);
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

  const byCase = useMemo(() => {
    if (!messages) return [];
    const groups = new Map<string, Message[]>();
    messages.forEach((m) => {
      const arr = groups.get(m.caseId) ?? [];
      arr.push(m);
      groups.set(m.caseId, arr);
    });
    const rows = Array.from(groups.entries()).map(([caseId, msgs]) => {
      msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { caseId, latest: msgs[0]!, count: msgs.length };
    });
    rows.sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime());
    return rows;
  }, [messages]);

  return (
    <AppShell breadcrumbs={['Surgeon', 'Messages']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Messages</span>
          <h1>Inbox &amp; <span className="emph">case threads</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>}

      {!messages ? (
        <div className="muted">Loading…</div>
      ) : byCase.length === 0 ? (
        <div className="card"><div className="muted">No messages on any of your cases yet.</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {byCase.map(({ caseId, latest, count }) => {
            const c = casesById.get(caseId);
            const p = c ? patientsById.get(c.patientId) : null;
            return (
              <Link
                key={caseId}
                href={`/app/surgeon/cases/${caseId}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: 14,
                  background: 'var(--surface-0, #fff)',
                  border: '1px solid var(--border, #eaeaea)',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
                    {p ? `${p.firstName} ${p.lastName}` : caseId.slice(0, 8)}
                  </div>
                  <span className={`role-pill role-${latest.authorRole}`} style={{ fontSize: 11 }}>
                    {latest.authorRole}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {new Date(latest.createdAt).toLocaleString()}
                  </span>
                  <span className="status-pill neutral" style={{ fontSize: 11 }}>{count}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latest.body}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
