'use client';

import { useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { PROMPTS, type PromptFixture } from '@/mocks/fixtures/admin';

const STUBS: Record<string, string> = {
  pmt_pre_op: `You are AnesthesiaClearance. Draft a pre-anesthesia note for human sign-off.

Patient
- Name: {{patient.name}}  Age: {{patient.age}}  ASA: {{asa}}
- Conditions: {{conditions}}
- Meds: {{medications}}

Sections (JSON)
1. airway  — Mallampati, BMI, STOP-BANG
2. cardiac — RCRI, functional capacity (METs)
3. pulmonary, renal, endocrine
4. recommendations — cited: {{citations}}
5. disposition — one of: cleared | conditional | defer

Badge every output "AI-drafted — review before signing".`,

  pmt_risk_summary: `Summarize perioperative risk for the surgeon cockpit.
Inputs: ASA, RCRI, STOP-BANG, functional capacity.
Output: 2 short paragraphs + 3 bullet recommendations with guideline citations.
Never output an unreviewed clearance status.`,

  pmt_referral: `Draft a specialist referral letter.

Clinical question: {{question}}
Relevant workup attached: {{attachments}}

Tone: concise, clinical, one page max. Include SLA: response requested within {{sla_days}} business days.`,

  pmt_sms_nudge: `Draft a patient SMS.

Constraints
- Reading-level 6 (use Dale–Chall).
- Max 160 characters.
- Preferred language: {{patient.language}}.
- Include deep link {{link}}.
- No PHI beyond first name.

Goal: {{goal}}.`,

  pmt_h_and_p: `You are DocumentationAgent. Draft an H&P from the latest Athena chart pull for {{patient.name}}.

Sections
- HPI · PMH · PSH · Allergies · Meds · ROS · PE · Assessment & Plan

Constraints
- Cite source encounters.
- Flag missing-but-required elements before clinician review.`,

  pmt_readiness: `Recompute the 0–100 readiness score for {{patient.name}}.

Weighted inputs
- Required workup completion: 30%
- Anesthesia clearance status: 25%
- Patient task completion: 20%
- Risk flags resolved: 15%
- Documentation signed: 10%`,
};

export default function AdminPromptsPage() {
  const [editing, setEditing] = useState<PromptFixture | null>(null);
  const [name, setName] = useState('');
  const [agent, setAgent] = useState('');
  const [desc, setDesc] = useState('');
  const [body, setBody] = useState('');

  const open = (p: PromptFixture) => {
    setEditing(p);
    setName(p.name);
    setAgent(p.agent);
    setDesc(p.description);
    setBody(STUBS[p.id] ?? '');
  };
  const openNew = () => {
    open({ id: 'new', name: 'New prompt', agent: '—', version: 0, updatedBy: '', updatedAt: '', description: '' });
  };
  const close = () => setEditing(null);

  return (
    <AppShell breadcrumbs={['Admin', 'Prompt library']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Prompt library</span>
          <h1>
            Versioned <span className="emph">prompts</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">Import</button>
          <button className="btn btn-primary" onClick={openNew}>New prompt</button>
        </div>
      </div>

      <div className="ai-banner">
        <b>Versioning</b> · every save creates a new immutable version. Agents pick up the latest
        at next <code>.invoke()</code>. Rollback is one click away.
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Used by</th>
            <th>Version</th>
            <th>Updated by</th>
            <th>When</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {PROMPTS.map((p) => (
            <tr key={p.id} onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) open(p); }} style={{ cursor: 'pointer' }}>
              <td>
                <div className="cell-primary">{p.name}</div>
                <div className="cell-sub">{p.description}</div>
              </td>
              <td>{p.agent}</td>
              <td><code>v{p.version}</code></td>
              <td>{p.updatedBy}</td>
              <td>{p.updatedAt}</td>
              <td style={{ textAlign: 'right' }}>
                <button
                  className="btn btn-ghost"
                  onClick={(e) => { e.stopPropagation(); open(p); }}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`slideover-overlay${editing ? ' open' : ''}`} onClick={close} />
      <aside className={`slideover${editing ? ' open' : ''}`} aria-hidden={!editing}>
        <div className="so-head">
          <h2>{editing ? `${editing.name} · v${editing.version}` : 'Prompt'}</h2>
          <button className="close-x" type="button" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="so-body">
          <div className="field-grid">
            <div className="field">
              <label>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Used by agent</label>
              <input type="text" value={agent} readOnly />
            </div>
          </div>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Description</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="field">
            <label>Template</label>
            <textarea className="prompt-ed" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="hint">
              Uses <code>{'{{var}}'}</code> substitution. Cited guidelines become <code>{'{{citations}}'}</code>.
            </div>
          </div>
        </div>
        <div className="so-foot">
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-outline-dark">Diff vs v{editing?.version ?? 0}</button>
          <button className="btn btn-primary" onClick={close}>Save as new version</button>
        </div>
      </aside>
    </AppShell>
  );
}
