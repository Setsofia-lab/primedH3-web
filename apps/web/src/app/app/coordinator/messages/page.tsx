'use client';

/**
 * Coordinator · Messages — Phase-1 two-pane "Patient + clinic threads"
 * restored.
 *
 *   page-head            "Patient + clinic threads."  Patients/Clinics toggle
 *   ai-banner            AI-drafted replies note
 *   inbox-pane           [ thread list ]   [ thread view + composer ]
 *
 * Real data:
 *   - /api/messages?limit=200   facility-scoped thread feed
 *   - /api/cases?limit=200      patient-of-case lookup
 *   - /api/patients?limit=200   thread display name
 *   - POST /api/messages        send reply
 *   - /api/cases/:id/agent-runs surface PatientCommsAgent draftReply if
 *                               there's a pending HITL draft for this case
 *
 * The Patients tab shows threads where the patient (or coordinator on
 * the patient's behalf) is on the wire. Clinics tab shows internal
 * threads (provider-to-provider coordination, no patient author).
 */
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { useCurrentUser } from '@/lib/auth/use-current-user';

interface Message {
  id: string;
  caseId: string;
  body: string;
  authorRole: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient' | 'agent';
  authorUserId: string | null;
  patientVisible: boolean;
  createdAt: string;
}
interface CaseRow {
  id: string;
  patientId: string;
  procedureCode: string | null;
  procedureDescription: string | null;
}
interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}
interface Run {
  id: string;
  agentKey: string;
  status: string;
  hitlStatus: string;
  outputJson: unknown;
  createdAt: string;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    const h = d.getHours();
    const ampm = h >= 12 ? 'p' : 'a';
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${String(d.getMinutes()).padStart(2, '0')}${ampm}`;
  }
  return d.toLocaleDateString('en-US', { weekday: 'short' }) + ` ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function shortAge(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Pull a draft reply from a PatientCommsAgent run output if present. */
function extractDraftReply(run: Run): string | null {
  const o = run.outputJson;
  if (!o || typeof o !== 'object') return null;
  const obj = o as Record<string, unknown>;
  for (const key of ['draftReply', 'draft_reply', 'reply', 'message', 'body']) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

type ThreadKind = 'patients' | 'clinics';

export default function CoordinatorMessagesPage() {
  const me = useCurrentUser();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [casesById, setCasesById] = useState<Map<string, CaseRow>>(new Map());
  const [patientsById, setPatientsById] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ThreadKind>('patients');
  const [selected, setSelected] = useState<string | null>(null); // caseId
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [runsForSelected, setRunsForSelected] = useState<Run[]>([]);

  async function load() {
    setError(null);
    try {
      const [m, c, p] = await Promise.all([
        jsonOrNull<{ items: Message[] }>(await fetch('/api/messages?limit=200')),
        jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
        jsonOrNull<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
      ]);
      setMessages(m?.items ?? []);
      setCasesById(new Map((c?.items ?? []).map((x) => [x.id, x])));
      setPatientsById(new Map((p?.items ?? []).map((x) => [x.id, x])));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); }, []);

  /* Group messages by case → thread rows on the left rail. */
  const threads = useMemo(() => {
    if (!messages) return [];
    const groups = new Map<string, Message[]>();
    for (const m of messages) {
      const arr = groups.get(m.caseId) ?? [];
      arr.push(m);
      groups.set(m.caseId, arr);
    }
    const rows = [...groups.entries()].map(([caseId, msgs]) => {
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const last = msgs[msgs.length - 1]!;
      const hasPatient = msgs.some((x) => x.authorRole === 'patient');
      return { caseId, msgs, last, hasPatient };
    });
    rows.sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());
    return rows;
  }, [messages]);

  const filteredThreads = useMemo(() => {
    if (tab === 'clinics') return threads.filter((t) => !t.hasPatient);
    return threads.filter((t) => t.hasPatient || true); // patients tab = all threads
  }, [threads, tab]);

  // Default to the most-recent thread in the current tab when nothing
  // is explicitly picked. Derived state — no effect / setState round-trip.
  const effectiveSelected = selected ?? filteredThreads[0]?.caseId ?? null;

  // Whenever the effectiveSelected case changes, refresh agent-runs for the AI
  // draft surface. Failures are quietly ignored — the composer still
  // works without a draft.
  useEffect(() => {
    if (!effectiveSelected) { setRunsForSelected([]); return; }
    let alive = true;
    void (async () => {
      const r = await jsonOrNull<{ items: Run[] }>(
        await fetch(`/api/cases/${effectiveSelected}/agent-runs?limit=20`),
      );
      if (alive) setRunsForSelected(r?.items ?? []);
    })();
    return () => { alive = false; };
  }, [effectiveSelected]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.caseId === effectiveSelected) ?? null,
    [threads, effectiveSelected],
  );

  const selectedCase = effectiveSelected ? casesById.get(effectiveSelected) : null;
  const selectedPatient = selectedCase ? patientsById.get(selectedCase.patientId) : null;

  /** Pending PatientCommsAgent draft for the effectiveSelected case (if any). */
  const aiDraft = useMemo(() => {
    const run = runsForSelected.find(
      (r) => r.agentKey === 'patient_comms' && r.hitlStatus === 'pending' && r.status === 'succeeded',
    );
    if (!run) return null;
    const body = extractDraftReply(run);
    return body ? { run, body } : null;
  }, [runsForSelected]);

  async function send(body: string, fromDraft = false) {
    if (!effectiveSelected || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: effectiveSelected,
          body: body.trim(),
          patientVisible: tab === 'patients',
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
      if (!fromDraft) setComposer('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell breadcrumbs={['Coordinator', 'Messages']}>
      <style jsx>{`
        .ms-toolbar { display:flex; align-items:center; }
        .seg-pill { display:inline-flex; background:var(--surface-100); border-radius:999px; padding:3px; }
        .seg-pill button { border:none; background:transparent; padding:0.375rem 0.875rem; border-radius:999px; cursor:pointer; font:inherit; font-size:0.8125rem; color:var(--ink-700); }
        .seg-pill button.active { background:var(--ink-900); color:#fff; }
        .inbox-pane {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          gap: 0;
          background: var(--surface-0);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          min-height: 540px;
        }
        @media (max-width: 900px) { .inbox-pane { grid-template-columns: 1fr; } }
        .thread-list {
          border-right: 1px solid var(--border);
          overflow-y: auto;
          max-height: 600px;
        }
        .thread-row {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          gap: 0.625rem;
          padding: 0.75rem 0.875rem;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          align-items: center;
        }
        .thread-row:hover { background: var(--surface-50, #fafafa); }
        .thread-row.active { background: var(--primary-blue-50, #eef1ff); }
        .thread-row .av {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--primary-blue); color: #fff;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-mono); font-size: 0.6875rem; font-weight: 600;
        }
        .thread-row .nm { font-weight: 600; font-size: 0.875rem; color: var(--ink-900); display:flex; align-items:center; gap:0.375rem; }
        .thread-row .nm .dot { width:6px; height:6px; border-radius:50%; background:var(--primary-blue); }
        .thread-row .pv { font-size: 0.75rem; color: var(--ink-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 220px; }
        .thread-row .ts { font-size: 0.6875rem; color: var(--ink-500); font-family: var(--font-mono); }

        .thread-view { display:flex; flex-direction:column; min-height: 540px; }
        .tv-head { display:flex; align-items:center; gap:0.75rem; padding:0.875rem 1.125rem; border-bottom:1px solid var(--border); }
        .tv-head .av { width:36px; height:36px; border-radius:50%; background:var(--primary-blue); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:0.75rem; font-weight:600; }
        .tv-head .nm { font-weight:600; font-size:0.9375rem; color:var(--ink-900); }
        .tv-head .sub { font-family:var(--font-mono); font-size:0.6875rem; color:var(--ink-500); letter-spacing:0.06em; text-transform:uppercase; margin-top:2px; }
        .tv-body { flex:1; overflow-y:auto; padding:1rem 1.125rem; display:flex; flex-direction:column; gap:0.75rem; max-height: 420px; }

        .bubble-row { display:flex; flex-direction:column; gap:0.25rem; max-width:75%; }
        .bubble-row.in { align-self:flex-start; }
        .bubble-row.out { align-self:flex-end; align-items:flex-end; }
        .bubble-meta { font-family:var(--font-mono); font-size:0.6875rem; color:var(--ink-500); letter-spacing:0.04em; }
        .bubble {
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          line-height: 1.45;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .bubble.in { background:var(--surface-100); color:var(--ink-900); border-top-left-radius:4px; }
        .bubble.out { background:var(--primary-blue); color:#fff; border-top-right-radius:4px; }
        .bubble.draft {
          background:#fff;
          color:var(--ink-900);
          border:1px dashed var(--primary-blue);
        }
        .draft-meta {
          font-family:var(--font-mono); font-size:0.6875rem; color:var(--primary-blue);
          letter-spacing:0.04em; display:flex; align-items:center; gap:0.375rem;
        }

        .composer {
          border-top:1px solid var(--border);
          padding: 0.75rem 1.125rem;
          display:flex; gap:0.625rem; align-items:flex-end;
        }
        .composer textarea {
          flex:1; resize:none; border:1px solid var(--border); border-radius:var(--radius-sm,6px);
          padding:0.5rem 0.625rem; font:inherit; font-size:0.875rem; min-height:48px; max-height:140px;
          color:var(--ink-900); background:#fff;
        }
        .composer .actions { display:flex; gap:0.375rem; }
      `}</style>

      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Messages</span>
          <h1>Patient + clinic <span className="emph">threads</span>.</h1>
        </div>
        <div className="page-actions">
          <div className="seg-pill" role="tablist">
            <button
              type="button"
              role="tab"
              className={tab === 'patients' ? 'active' : ''}
              onClick={() => { setTab('patients'); setSelected(null); }}
            >
              Patients
            </button>
            <button
              type="button"
              role="tab"
              className={tab === 'clinics' ? 'active' : ''}
              onClick={() => { setTab('clinics'); setSelected(null); }}
            >
              Clinics
            </button>
          </div>
        </div>
      </div>

      <div className="ai-banner">
        <b>◆ AI-drafted replies</b> from PatientCommsAgent appear as dashed-blue bubbles.
        Approve to send — every outbound message carries a human sign-off.
      </div>

      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>
      )}

      <div className="inbox-pane">
        {/* LEFT — thread rail */}
        <div className="thread-list">
          {!messages ? (
            <div className="muted" style={{ padding: '1rem' }}>Loading…</div>
          ) : filteredThreads.length === 0 ? (
            <div className="muted" style={{ padding: '1rem', fontSize: '0.875rem' }}>
              {tab === 'clinics'
                ? 'No internal clinic threads yet.'
                : 'No patient threads yet. Open a case and use the case-detail Messages tab to start one.'}
            </div>
          ) : (
            filteredThreads.map(({ caseId, last, msgs }) => {
              const c = casesById.get(caseId);
              const p = c ? patientsById.get(c.patientId) : null;
              const name = p ? `${p.firstName} ${p.lastName}` : `Case ${caseId.slice(0, 8)}`;
              const hasUnread = msgs.some((m) => m.authorRole === 'patient' && new Date(m.createdAt).getTime() > Date.now() - 6 * 3600 * 1000);
              return (
                <div
                  key={caseId}
                  className={`thread-row${effectiveSelected === caseId ? ' active' : ''}`}
                  onClick={() => setSelected(caseId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelected(caseId); }}
                >
                  <span className="av">{p ? initials(p.firstName, p.lastName) : '··'}</span>
                  <div>
                    <div className="nm">
                      {name}
                      {hasUnread && <span className="dot" aria-label="unread" />}
                    </div>
                    <div className="pv">{last.body}</div>
                  </div>
                  <span className="ts">{shortAge(last.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT — thread view */}
        <div className="thread-view">
          {!selectedThread || !effectiveSelected ? (
            <div className="muted" style={{ padding: '2rem', fontSize: '0.875rem' }}>
              Pick a thread on the left to read & reply.
            </div>
          ) : (
            <>
              <div className="tv-head">
                <span className="av">
                  {selectedPatient
                    ? initials(selectedPatient.firstName, selectedPatient.lastName)
                    : '··'}
                </span>
                <div>
                  <div className="nm">
                    {selectedPatient
                      ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                      : `Case ${effectiveSelected.slice(0, 8)}`}
                  </div>
                  <div className="sub">
                    {tab === 'patients' ? 'PATIENT' : 'CLINIC'}
                    {selectedCase?.procedureDescription
                      ? ` · Re: ${selectedCase.procedureDescription}`
                      : selectedCase?.procedureCode
                        ? ` · Re: ${selectedCase.procedureCode}`
                        : ''}
                  </div>
                </div>
              </div>

              <div className="tv-body">
                {selectedThread.msgs.map((m) => {
                  // For the coordinator's view of the inbox, the
                  // "patient" side is incoming; everyone else (the
                  // care team) is outgoing.
                  const fromPatient = m.authorRole === 'patient';
                  const out = !fromPatient && m.authorRole !== 'agent';
                  const dirClass = out ? 'out' : 'in';
                  const authorLabel = fromPatient
                    ? (selectedPatient?.firstName ?? 'Patient')
                    : m.authorRole === 'coordinator' && me?.role === 'coordinator'
                      ? 'you'
                      : m.authorRole;
                  return (
                    <div className={`bubble-row ${dirClass}`} key={m.id}>
                      <div className="bubble-meta">
                        {authorLabel} · {fmtTime(m.createdAt)}
                      </div>
                      <div className={`bubble ${dirClass}`}>{m.body}</div>
                    </div>
                  );
                })}

                {aiDraft && (
                  <div className="bubble-row out">
                    <div className="draft-meta">
                      ◆ PatientCommsAgent draft · just now
                    </div>
                    <div className="bubble draft">{aiDraft.body}</div>
                  </div>
                )}
              </div>

              <div className="composer">
                <textarea
                  placeholder="Write a message, or approve the AI draft above…"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      void send(composer);
                    }
                  }}
                />
                <div className="actions">
                  {aiDraft && (
                    <button
                      type="button"
                      className="btn btn-outline-dark"
                      onClick={() => setComposer(aiDraft.body)}
                      disabled={sending}
                      title="Move the AI draft into the composer to edit before sending"
                    >
                      Edit draft
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      void send(composer || aiDraft?.body || '', !composer && !!aiDraft)
                    }
                    disabled={sending || (!composer.trim() && !aiDraft)}
                  >
                    {sending ? 'Sending…' : aiDraft && !composer ? 'Approve & send' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
