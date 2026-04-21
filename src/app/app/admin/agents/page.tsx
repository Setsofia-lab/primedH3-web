'use client';

import { useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AGENTS, type AgentFixture } from '@/mocks/fixtures/admin';

const PROMPT_STUB = (name: string) =>
  `You are ${name}, part of the PrimedHealth perioperative team.

Role
- Draft clinical/communication artifacts for human sign-off.
- Cite guidelines (ASA, NSQIP, ACC/AHA) with year.
- Never fabricate patient data.

Output format
- Structured JSON matching the tool schema.
- Include confidence + reasoning trace.

Guardrails
- All outputs carry "AI-drafted · review before sending" badge.
- Flag deferral conditions per clinic policy.`;

export default function AdminAgentsPage() {
  const [editing, setEditing] = useState<AgentFixture | null>(null);
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [temp, setTemp] = useState(0.2);
  const [prompt, setPrompt] = useState('');

  const open = (a: AgentFixture) => {
    setEditing(a);
    setModel(a.model);
    setTemp(a.temperature);
    setPrompt(PROMPT_STUB(a.name));
  };
  const close = () => setEditing(null);

  return (
    <AppShell breadcrumbs={['Admin', 'Agents']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Agents</span>
          <h1>
            The {AGENTS.length} <span className="emph">agents</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">View runs</button>
        </div>
      </div>

      <div className="ai-banner">
        <b>Phase 1</b> · prompts execute via scripted fixtures. Edits here save to the prompt
        library for Phase 3 hand-off to the real LangChain runtime.
      </div>

      <div className="agents-grid">
        {AGENTS.map((a) => (
          <button
            type="button"
            className="agent-card"
            key={a.id}
            onClick={() => open(a)}
            style={{ textAlign: 'left', font: 'inherit' }}
          >
            <div className="top">
              <div className="nm">{a.name}</div>
              <span className={`status-pill ${a.status}`}>{a.status}</span>
            </div>
            <p className="desc">{a.description}</p>
            <div className="meta">
              <span><b>{a.model}</b></span>
              <span>temp <b>{a.temperature}</b></span>
              <span>{a.runs24h} runs/24h</span>
              <span>p50 {a.p50}s</span>
            </div>
          </button>
        ))}
      </div>

      {/* Editor slideover */}
      <div
        className={`slideover-overlay${editing ? ' open' : ''}`}
        onClick={close}
      />
      <aside
        className={`slideover${editing ? ' open' : ''}`}
        aria-hidden={!editing}
      >
        <div className="so-head">
          <h2>{editing?.name ?? 'Agent'}</h2>
          <button className="close-x" type="button" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="so-body">
          <div className="ai-banner">
            <b>AI-drafted</b> · all outputs from this agent are marked for human review before
            patient/provider surfaces.
          </div>
          <div className="field-grid">
            <div className="field">
              <label>Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option>claude-haiku-4-5</option>
                <option>claude-sonnet-4-5</option>
                <option>claude-opus-4-5</option>
              </select>
            </div>
            <div className="field">
              <label>Temperature</label>
              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                />
                <span className="v">{temp.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Max tokens</label>
            <input type="number" defaultValue={2048} min={256} max={8192} step={256} />
          </div>
          <div className="field">
            <label>System prompt</label>
            <textarea className="prompt-ed" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <div className="hint">
              Version saved automatically. Downstream runs pick up new prompt on next <code>.invoke()</code>.
            </div>
          </div>
        </div>
        <div className="so-foot">
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-outline-dark">Test run</button>
          <button className="btn btn-primary" onClick={close}>Save version</button>
        </div>
      </aside>
    </AppShell>
  );
}
