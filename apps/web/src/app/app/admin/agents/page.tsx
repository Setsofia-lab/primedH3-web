'use client';

/**
 * Admin · Agents — original Phase 1 visual + live data.
 *
 *   page-head     "The N agents." with "View runs" CTA
 *   ai-banner     phase-3 hand-off note
 *   agents-grid   3-col grid of agent cards
 *   slideover     drawer with model / temperature / max_tokens /
 *                 system-prompt editor; "Save version" creates a new
 *                 row in agent_prompts via the existing
 *                 POST /admin/agents/:key/prompts endpoint.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';

interface Agent {
  id: string;
  key: string;
  displayName: string;
  role: string;
  defaultModel: string;
  defaultTemperature: number;
  enabled: boolean;
}
interface Run {
  id: string;
  agentKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  latencyMs: number | null;
  createdAt: string;
}
interface PromptVersion {
  id: string;
  version: number;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  note: string | null;
  createdAt: string;
}

const MODEL_OPTIONS = [
  'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-sonnet-4-6',
  'us.anthropic.claude-opus-4-7',
] as const;
type ModelId = (typeof MODEL_OPTIONS)[number];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function p50(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
function shortModel(m: string): string {
  return m.replace(/^us\.anthropic\./, '').replace(/-\d{8}-v\d:0$/, '');
}

interface DraftState {
  model: ModelId;
  temperature: number;
  maxTokens: number;
  prompt: string;
  note: string;
  loadingActive: boolean;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [a, r] = await Promise.all([
        jsonOrThrow<{ items: Agent[] }>(await fetch('/api/admin/agents')),
        jsonOrNull<{ items: Run[] }>(await fetch('/api/admin/agents/runs?limit=300')),
      ]);
      setAgents(a.items);
      setRuns(r?.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); }, []);

  // Derive per-agent stats from the run rows (24h window).
  const stats = useMemo(() => {
    const last24h = Date.now() - 24 * 3600 * 1000;
    const out = new Map<string, { runs24h: number; p50s: string; failed: number }>();
    for (const a of agents ?? []) {
      const aRuns = runs.filter(
        (r) => r.agentKey === a.key && new Date(r.createdAt).getTime() >= last24h,
      );
      const lats = aRuns.map((r) => r.latencyMs ?? 0).filter((x) => x > 0);
      out.set(a.key, {
        runs24h: aRuns.length,
        p50s: (p50(lats) / 1000).toFixed(1),
        failed: aRuns.filter((r) => r.status === 'failed').length,
      });
    }
    return out;
  }, [agents, runs]);

  function statusFor(a: Agent): 'completed' | 'deferred' | 'cancelled' {
    if (!a.enabled) return 'cancelled';
    const s = stats.get(a.key);
    if (s && s.failed > 0) return 'deferred';
    return 'completed';
  }
  function statusLabel(a: Agent): 'healthy' | 'degraded' | 'disabled' {
    const s = statusFor(a);
    return s === 'completed' ? 'healthy' : s === 'deferred' ? 'degraded' : 'disabled';
  }

  async function open(a: Agent): Promise<void> {
    setEditing(a);
    setSaveOk(null);
    setError(null);
    setDraft({
      model: (MODEL_OPTIONS as readonly string[]).includes(a.defaultModel)
        ? (a.defaultModel as ModelId)
        : 'us.anthropic.claude-sonnet-4-6',
      temperature: a.defaultTemperature,
      maxTokens: 2048,
      prompt: '',
      note: '',
      loadingActive: true,
    });
    // Load active prompt version (so the textarea shows the live system prompt)
    try {
      const r = await jsonOrThrow<{ items: PromptVersion[] }>(
        await fetch(`/api/admin/agents/${encodeURIComponent(a.key)}/prompts`),
      );
      const active = r.items.find((v) => v.isActive) ?? r.items[0];
      if (active) {
        setDraft((d) => d ? {
          ...d,
          model: (MODEL_OPTIONS as readonly string[]).includes(active.model)
            ? (active.model as ModelId) : d.model,
          temperature: active.temperature,
          prompt: active.systemPrompt,
          loadingActive: false,
        } : d);
      } else {
        setDraft((d) => d ? { ...d, loadingActive: false } : d);
      }
    } catch (e) {
      setDraft((d) => d ? { ...d, loadingActive: false } : d);
      setError((e as Error).message);
    }
  }
  function close(): void {
    setEditing(null);
    setDraft(null);
  }

  async function saveVersion(): Promise<void> {
    if (!editing || !draft) return;
    setSaving(true); setSaveOk(null); setError(null);
    try {
      await jsonOrThrow<PromptVersion>(
        await fetch(`/api/admin/agents/${encodeURIComponent(editing.key)}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: draft.prompt,
            model: draft.model,
            temperature: draft.temperature,
            note: draft.note || undefined,
          }),
        }),
      );
      setSaveOk('Version saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function testRun(): Promise<void> {
    // Re-runs the IntakeOrchestrator (or this agent if mappable) on the
    // first available case so the operator can sanity-check the prompt.
    if (!editing) return;
    try {
      const c = await jsonOrThrow<{ items: Array<{ id: string }> }>(
        await fetch('/api/admin/cases?limit=1'),
      );
      const caseId = c.items[0]?.id;
      if (!caseId) {
        setError('No cases available — create one first to dispatch a test run.');
        return;
      }
      await jsonOrThrow(
        await fetch(`/api/admin/cases/${caseId}/dispatch-agent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentKey: editing.key }),
        }),
      );
      setSaveOk('Test run dispatched. Watch /app/admin (Live agent activity).');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <AppShell breadcrumbs={['Admin', 'Agents']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Agents</span>
          <h1>
            The {agents?.length ?? '—'} <span className="emph">agents</span>.
          </h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline-dark" href="/app/admin">View runs</Link>
        </div>
      </div>

      <div className="ai-banner">
        <b>Live</b> · prompts execute via the Bedrock-backed worker. Edits here save
        to the prompt registry; the next agent run picks up the active version.
      </div>

      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', margin: '8px 0', fontSize: 13 }}>{error}</div>
      )}

      <div className="agents-grid">
        {!agents ? (
          <div className="muted" style={{ padding: '1rem' }}>Loading…</div>
        ) : agents.length === 0 ? (
          <div className="muted" style={{ padding: '1rem' }}>No agents registered yet.</div>
        ) : agents.map((a) => {
          const s = stats.get(a.key) ?? { runs24h: 0, p50s: '0.0', failed: 0 };
          return (
            <button
              type="button"
              className="agent-card"
              key={a.id}
              onClick={() => void open(a)}
              style={{ textAlign: 'left', font: 'inherit' }}
            >
              <div className="top">
                <div className="nm">{a.displayName}</div>
                <span className={`status-pill ${statusFor(a)}`}>{statusLabel(a)}</span>
              </div>
              <p className="desc">{a.role}</p>
              <div className="meta">
                <span><b>{shortModel(a.defaultModel)}</b></span>
                <span>temp <b>{a.defaultTemperature.toFixed(1)}</b></span>
                <span>{s.runs24h} runs/24h</span>
                <span>p50 {s.p50s}s</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Editor slideover — opens when an agent card is clicked */}
      <div
        className={`slideover-overlay${editing ? ' open' : ''}`}
        onClick={close}
      />
      <aside
        className={`slideover${editing ? ' open' : ''}`}
        aria-hidden={!editing}
      >
        <div className="so-head">
          <h2>{editing?.displayName ?? 'Agent'}</h2>
          <button className="close-x" type="button" onClick={close} aria-label="Close">✕</button>
        </div>
        {editing && draft && (
          <>
            <div className="so-body">
              <div className="ai-banner">
                <b>AI-drafted</b> · all outputs from this agent are marked for human review before
                patient/provider surfaces.
              </div>
              <div className="field-grid">
                <div className="field">
                  <label>Model</label>
                  <select
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value as ModelId })}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m} value={m}>{shortModel(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Temperature</label>
                  <div className="slider-row">
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={draft.temperature}
                      onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
                    />
                    <span className="v">{draft.temperature.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label>Max tokens</label>
                <input
                  type="number" min={256} max={8192} step={256}
                  value={draft.maxTokens}
                  onChange={(e) => setDraft({ ...draft, maxTokens: Number(e.target.value) })}
                />
              </div>
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label>Note (why this version)</label>
                <input
                  type="text" placeholder="e.g. tightened JSON output schema"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </div>
              <div className="field">
                <label>System prompt</label>
                <textarea
                  className="prompt-ed"
                  value={draft.loadingActive ? 'Loading active version…' : draft.prompt}
                  onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                  rows={16}
                />
                <div className="hint">
                  Saving creates a new <em>inactive</em> version. Promote from{' '}
                  <Link href={`/app/admin/agents/${encodeURIComponent(editing.key)}`}>
                    versions list
                  </Link>{' '}
                  to make it pick up on the next <code>.invoke()</code>.
                </div>
              </div>
              {saveOk && (
                <div className="muted" style={{ marginTop: 8, color: 'var(--success, #0f7838)' }}>
                  {saveOk}
                </div>
              )}
            </div>
            <div className="so-foot">
              <button className="btn btn-ghost" onClick={close}>Cancel</button>
              <button className="btn btn-outline-dark" onClick={() => void testRun()}>Test run</button>
              <button
                className="btn btn-primary"
                onClick={() => void saveVersion()}
                disabled={saving || draft.loadingActive || draft.prompt.length < 20}
              >
                {saving ? 'Saving…' : 'Save version'}
              </button>
            </div>
          </>
        )}
      </aside>
    </AppShell>
  );
}
