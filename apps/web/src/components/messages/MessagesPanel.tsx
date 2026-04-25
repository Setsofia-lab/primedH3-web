'use client';

/**
 * MessagesPanel — drop-in case-thread UI.
 *
 * Used on every role's case detail page. Lists messages oldest→newest,
 * shows author role pills, has a "share with patient" toggle (hidden
 * for patients themselves; their posts are always patient-visible).
 */
import { useEffect, useRef, useState } from 'react';

export interface Message {
  id: string;
  caseId: string;
  authorUserId: string;
  authorRole: string;
  body: string;
  patientVisible: boolean;
  createdAt: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

interface Props {
  caseId: string;
  /** Hide the patient-visible toggle (e.g. when caller IS a patient). */
  hidePatientToggle?: boolean;
  /** Pre-set the toggle (for the patient inbox UX where everything is patient-visible). */
  defaultPatientVisible?: boolean;
}

export function MessagesPanel({ caseId, hidePatientToggle, defaultPatientVisible }: Props) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [pv, setPv] = useState(defaultPatientVisible ?? false);
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    setError(null);
    try {
      const r = await jsonOrThrow<{ items: Message[] }>(
        await fetch(`/api/messages?caseId=${caseId}&limit=200`),
      );
      setMessages(r.items);
      // Scroll to bottom on next paint.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await jsonOrThrow(
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, body: body.trim(), patientVisible: pv }),
        }),
      );
      setBody('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Messages</h3>
        {messages && (
          <span className="status-pill neutral">{messages.length}</span>
        )}
      </div>
      {error && <div style={{ color: 'var(--danger, #c0392b)', marginBottom: 12 }}>{error}</div>}

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: 360,
          overflowY: 'auto',
          paddingRight: 4,
          marginBottom: 12,
        }}
      >
        {!messages ? (
          <div className="muted">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="muted">No messages on this case yet.</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                background: 'var(--surface-50, #fafafa)',
                border: '1px solid var(--border, #eaeaea)',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                <span className={`role-pill role-${m.authorRole}`} style={{ fontSize: 11 }}>
                  {m.authorRole}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {new Date(m.createdAt).toLocaleString()}
                </span>
                {m.patientVisible && (
                  <span className="status-pill neutral" style={{ fontSize: 10 }}>
                    visible to patient
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          className="input"
          rows={3}
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!hidePatientToggle && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-700, #555)' }}>
              <input type="checkbox" checked={pv} onChange={(e) => setPv(e.target.checked)} />
              Share with patient
            </label>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" type="submit" disabled={posting || !body.trim()}>
            {posting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
