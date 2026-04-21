'use client';

import { useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

type Direction = 'in' | 'out' | 'draft';
interface Bubble { by: string; dir: Direction; t: string; ts: string }
interface Thread {
  id: string;
  who: string;
  initials: string;
  sub: string;
  pv: string;
  tm: string;
  unread: boolean;
  msgs: Bubble[];
}

const THREADS: Thread[] = [
  {
    id: 't1', who: 'Maya Khan', initials: 'MK', sub: 'Re: Pre-op instructions',
    pv: 'Sorry, I missed your call — can I do this by text?', tm: '2m', unread: true,
    msgs: [
      { by: 'Maya', dir: 'in', t: 'Hi, is someone there? I got a call but missed it.', ts: 'Wed 9:42a' },
      { by: 'Priya · you', dir: 'out', t: 'Hi Maya! Yes — no problem at all. Wanted to check in about your pre-op instructions.', ts: 'Wed 9:44a' },
      { by: 'Maya', dir: 'in', t: 'Sorry, I missed your call — can I do this by text?', ts: 'Wed 9:58a' },
      {
        by: '◆ PatientCommsAgent draft · reading level 6',
        dir: 'draft',
        t: 'Of course, Maya! Text works great. Here\u2019s the short version:\n\n1. Nothing to eat or drink after midnight the night before.\n2. Arrive at Bayview at 6:30am — building B, 2nd floor.\n3. Bring your ID and someone to drive you home.\n\nWant me to send the full pre-op pack to your phone?',
        ts: 'draft · just now',
      },
    ],
  },
  {
    id: 't2', who: 'Daniel Shaw', initials: 'DS', sub: 'Re: Cardiology consult',
    pv: 'They scheduled me for next Tuesday at 3pm.', tm: '1h', unread: true,
    msgs: [{ by: 'Daniel', dir: 'in', t: 'Dr. Lin\u2019s office called — they scheduled me for next Tuesday at 3pm. Is that okay?', ts: 'Today 10:21a' }],
  },
  {
    id: 't3', who: 'Alex Rivera', initials: 'AR', sub: 'Re: Surgery date confirm',
    pv: 'Yes, Apr 28 works for me — thanks!', tm: '3h', unread: false,
    msgs: [{ by: 'Alex', dir: 'in', t: 'Yes, Apr 28 works for me — thanks!', ts: 'Today 8:12a' }],
  },
  { id: 't4', who: 'Jordan Park', initials: 'JP', sub: 'Re: Pre-op appointment', pv: '◆ AI draft ready for review', tm: '5h', unread: true, msgs: [] },
  { id: 't5', who: 'Nora Bright', initials: 'NB', sub: 'Re: Labs from Outside Lab', pv: 'I called them — they\u2019re faxing today.', tm: 'Yesterday', unread: false, msgs: [] },
  { id: 't6', who: 'Raj Patel',   initials: 'RP', sub: 'Re: Day-of transport',     pv: 'My sister can drive, is that fine?',         tm: 'Yesterday', unread: true,  msgs: [] },
  { id: 't7', who: 'Ella Guo',    initials: 'EG', sub: 'Re: OR slot confirm',      pv: '10am May 6 is perfect, thank you!',          tm: '2d',        unread: false, msgs: [] },
];

export default function CoordinatorMessagesPage() {
  const [activeId, setActiveId] = useState('t1');
  const active = THREADS.find((t) => t.id === activeId);

  return (
    <AppShell breadcrumbs={['Coordinator', 'Messages']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Messages</span>
          <h1>
            Patient + clinic <span className="emph"><em>threads</em></span>.
          </h1>
        </div>
        <div className="page-actions">
          <div
            className="seg"
            style={{
              display: 'inline-flex',
              background: 'var(--surface-0)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
            }}
          >
            <button className="active">Patients</button>
            <button>Clinics</button>
          </div>
        </div>
      </div>

      <div className="ai-banner">
        <b>◆ AI-drafted replies</b> from PatientCommsAgent appear as dashed blue bubbles. Approve to
        send — every outbound message carries a human sign-off.
      </div>

      <div className="thread-layout">
        <div className="thread-list">
          {THREADS.map((th) => (
            <div
              key={th.id}
              className={`t${th.unread ? ' unread' : ''}${th.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(th.id)}
            >
              <span className="av">{th.initials}</span>
              <div>
                <div className="who">{th.who}</div>
                <div className="pv">{th.pv}</div>
              </div>
              <span className="tm">{th.tm}</span>
            </div>
          ))}
        </div>

        <div className="thread-pane">
          {active && (
            <>
              <div className="ph">
                <span className="av">{active.initials}</span>
                <div>
                  <div className="who">{active.who}</div>
                  <div className="meta">PATIENT · {active.sub}</div>
                </div>
              </div>
              <div className="pb">
                {active.msgs.length === 0 && (
                  <div
                    style={{
                      color: 'var(--ink-500)',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      margin: 'auto',
                    }}
                  >
                    No messages in this thread yet.
                  </div>
                )}
                {active.msgs.map((m, i) => (
                  <div className={`bubble ${m.dir}`} key={i}>
                    <div className="by">
                      {m.by} · {m.ts}
                    </div>
                    {m.t.split('\n').map((p, j) => (
                      <div key={j}>{p || '\u00A0'}</div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pf">
                <textarea placeholder="Write a message, or approve the AI draft above…" />
                <button className="btn btn-outline-dark">Edit draft</button>
                <button className="btn btn-primary">Approve &amp; send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
