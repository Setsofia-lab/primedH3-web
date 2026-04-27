'use client';

/**
 * AgentsPanel — fires manual agent runs on a case from the case detail
 * page. Auto-fan-out agents (intake, risk, anesthesia, readiness)
 * already run on case.created, so we keep their buttons available for
 * re-runs after data changes; on-demand agents (scheduling, referral)
 * are the primary use case.
 *
 * Each click hits POST /api/admin/cases/:id/dispatch-agent and shows
 * a confirmation toast with the new run id; the new row appears in
 * /app/admin/agents within seconds.
 */
import { useState } from 'react';

interface AgentTrigger {
  key:
    | 'intake_orchestrator'
    | 'risk_screening'
    | 'anesthesia_clearance'
    | 'scheduling'
    | 'referral'
    | 'patient_comms'
    | 'pre_hab'
    | 'documentation'
    | 'task_tracker'
    | 'readiness';
  label: string;
  hint: string;
}

const TRIGGERS: AgentTrigger[] = [
  { key: 'scheduling', label: 'Propose slots', hint: 'SchedulingAgent — proposes 3-5 surgery dates (HITL pending).' },
  { key: 'referral', label: 'Draft referral', hint: 'ReferralAgent — drafts a specialty letter (HITL pending).' },
  { key: 'patient_comms', label: 'Draft patient reply', hint: 'PatientCommsAgent — drafts a reply to a patient message.' },
  { key: 'documentation', label: 'Draft H&P / op-note', hint: 'DocumentationAgent — drafts a clinical document for surgeon sign-off.' },
  { key: 'task_tracker', label: 'Re-bucket tasks', hint: 'TaskTrackerAgent — re-organizes the case task list with handoff suggestions.' },
  { key: 'pre_hab', label: 'Re-run pre-hab', hint: 'PreHabAgent — drafts the regimen + adherence check-ins.' },
  { key: 'risk_screening', label: 'Re-run risk screen', hint: 'NSQIP-style screen; always pending HITL.' },
  { key: 'anesthesia_clearance', label: 'Re-run anesthesia', hint: 'ASA / RCRI / STOP-BANG draft (HITL pending).' },
  { key: 'readiness', label: 'Recompute readiness', hint: 'Re-aggregates the 0-100 score.' },
  { key: 'intake_orchestrator', label: 'Re-run intake', hint: 'Re-seeds the workup task list.' },
];

export function AgentsPanel({ caseId }: { caseId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<{ key: string; runId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fire(key: AgentTrigger['key']) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/dispatch-agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentKey: key }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      const json = JSON.parse(text) as { runId: string };
      setLast({ key, runId: json.runId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="card-head" style={{ marginBottom: '0.5rem' }}>
        <h3>Agents</h3>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
        Manually trigger an agent run. New rows show up under{' '}
        <a href="/app/admin/agents" target="_blank" rel="noreferrer">/app/admin/agents</a>{' '}
        with their HITL pill.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        {TRIGGERS.map((t) => (
          <button
            key={t.key}
            className="btn btn-outline-dark"
            onClick={() => void fire(t.key)}
            disabled={busy !== null}
            title={t.hint}
            style={{ justifyContent: 'flex-start', textAlign: 'left' }}
          >
            {busy === t.key ? 'Dispatching…' : t.label}
          </button>
        ))}
      </div>
      {last && (
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Dispatched <code>{last.key}</code> · run id{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>{last.runId.slice(0, 8)}</code>.
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', fontSize: 12, marginTop: 10 }}>{error}</div>
      )}
    </div>
  );
}
