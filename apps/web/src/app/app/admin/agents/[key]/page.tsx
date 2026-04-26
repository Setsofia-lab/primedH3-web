'use client';

/**
 * Admin · Agents · [key] — prompt registry editor (M11.7).
 *
 * Lists every version of an agent's prompt (newest first), shows which
 * is active, and lets an admin draft a new version. Versions are
 * immutable once created — the only "edit" is "save as new version,
 * then activate".
 */
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

interface AgentRow {
  id: string;
  key: string;
  displayName: string;
  role: string;
  defaultModel: string;
  defaultTemperature: number;
  enabled: boolean;
}

interface PromptRow {
  id: string;
  version: number;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  authorUserId: string | null;
}

const MODEL_OPTIONS = [
  'anthropic.claude-sonnet-4-7',
  'anthropic.claude-opus-4-7',
  'anthropic.claude-haiku-4-5',
] as const;
type ModelId = (typeof MODEL_OPTIONS)[number];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

export default function AdminAgentDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [versions, setVersions] = useState<PromptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftFromId, setDraftFromId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    systemPrompt: string;
    model: ModelId;
    temperature: number;
    note: string;
  } | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await jsonOrThrow<{ agent: AgentRow; items: PromptRow[] }>(
        await fetch(`/api/admin/agents/${encodeURIComponent(key)}/prompts`),
      );
      setAgent(r.agent);
      setVersions(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const active = useMemo(() => versions?.find((v) => v.isActive) ?? null, [versions]);

  function startEditingFrom(v: PromptRow) {
    setDraftFromId(v.id);
    setDraft({
      systemPrompt: v.systemPrompt,
      model: (MODEL_OPTIONS as readonly string[]).includes(v.model)
        ? (v.model as ModelId)
        : 'anthropic.claude-sonnet-4-7',
      temperature: v.temperature,
      note: '',
    });
  }
  function startBlankDraft() {
    setDraftFromId(null);
    setDraft({
      systemPrompt: '',
      model: 'anthropic.claude-sonnet-4-7',
      temperature: 0.2,
      note: '',
    });
  }
  function cancelDraft() {
    setDraft(null);
    setDraftFromId(null);
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy('save');
    try {
      await jsonOrThrow<PromptRow>(
        await fetch(`/api/admin/agents/${encodeURIComponent(key)}/prompts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: draft.systemPrompt,
            model: draft.model,
            temperature: draft.temperature,
            note: draft.note || undefined,
          }),
        }),
      );
      setDraft(null);
      setDraftFromId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function activate(id: string) {
    setBusy(id);
    try {
      await jsonOrThrow<PromptRow>(
        await fetch(
          `/api/admin/agents/${encodeURIComponent(key)}/prompts/${encodeURIComponent(id)}/activate`,
          { method: 'POST' },
        ),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell breadcrumbs={['Admin', 'Agents', agent?.displayName ?? key]}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Agents</span>
          <h1>
            {agent?.displayName ?? key} <span className="emph">prompt versions</span>.
          </h1>
          {agent && <p className="muted">{agent.role}</p>}
        </div>
        <div className="page-actions">
          <Link href="/app/admin/agents" className="btn btn-outline-dark">
            Back to registry
          </Link>
          <button className="btn btn-primary" onClick={startBlankDraft} disabled={!!draft}>
            New version
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>
      )}

      {/* Active summary */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Active version</h3>
        </div>
        {!active ? (
          <div className="muted">
            No active version. Click <strong>New version</strong> to bootstrap one — the
            worker will fall back to the agent&apos;s hardcoded prompt until you do.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16 }}>
            <div className="muted" style={{ fontSize: 12 }}>version</div>
            <div>v{active.version}</div>
            <div className="muted" style={{ fontSize: 12 }}>model / temp</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {active.model} · t={active.temperature.toFixed(2)}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>created</div>
            <div>{new Date(active.createdAt).toLocaleString()}</div>
            {active.note && (
              <>
                <div className="muted" style={{ fontSize: 12 }}>note</div>
                <div>{active.note}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Draft editor */}
      {draft && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <h3>
              Draft {draftFromId ? '(edited from a previous version)' : '(blank)'}
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'start' }}>
            <label>Model</label>
            <select
              className="input"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value as ModelId })}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <label>Temperature</label>
            <input
              className="input"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={draft.temperature}
              onChange={(e) =>
                setDraft({ ...draft, temperature: Number(e.target.value) })
              }
              style={{ width: 120 }}
            />

            <label>Note</label>
            <input
              className="input"
              type="text"
              placeholder="Why this version exists"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />

            <label style={{ alignSelf: 'start', marginTop: 6 }}>System prompt</label>
            <textarea
              className="input"
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              rows={20}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline-dark" onClick={cancelDraft} disabled={busy === 'save'}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void saveDraft()}
              disabled={busy === 'save' || draft.systemPrompt.trim().length < 20}
            >
              {busy === 'save' ? 'Saving…' : 'Save as new version'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Saving creates a new <em>inactive</em> version. Click <strong>Activate</strong>
            on the version to promote it — the worker reads the active version on the next
            run (cached for 60s).
          </p>
        </div>
      )}

      {/* Versions list */}
      {!versions ? (
        <div className="muted">Loading…</div>
      ) : versions.length === 0 ? (
        <div className="card">
          <div className="muted">
            No versions yet. The worker is using the agent&apos;s hardcoded default prompt.
            Click <strong>New version</strong> to seed v1.
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Model</th>
              <th>Temp</th>
              <th>Created</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>v{v.version}</td>
                <td>
                  <span className={`status-pill ${v.isActive ? 'completed' : 'neutral'}`}>
                    {v.isActive ? 'active' : 'inactive'}
                  </span>
                </td>
                <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {v.model}
                </td>
                <td>{v.temperature.toFixed(2)}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {new Date(v.createdAt).toLocaleString()}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{v.note ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-link"
                    onClick={() => startEditingFrom(v)}
                    disabled={!!draft}
                  >
                    Fork
                  </button>
                  {!v.isActive && (
                    <button
                      className="btn btn-link"
                      onClick={() => void activate(v.id)}
                      disabled={busy === v.id}
                    >
                      {busy === v.id ? 'Activating…' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
