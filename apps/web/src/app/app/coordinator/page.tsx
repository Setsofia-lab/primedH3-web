'use client';

/**
 * Coordinator · Board — real cases, kanban-style by lifecycle status.
 *
 * Columns mirror the case_status enum (Constitution §3.4): Referral →
 * Workup → Clearance → Pre-hab → Ready → Completed. Cancelled cases
 * are hidden from the board (they show on a separate filter view in M8).
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { useCurrentUser } from '@/lib/auth/use-current-user';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

interface CaseRow {
  id: string;
  patientId: string;
  surgeonId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  readinessScore: number | null;
  surgeryDate: string | null;
  createdAt: string;
}
interface Patient { id: string; firstName: string; lastName: string; dob: string; }
interface Provider { id: string; firstName: string; lastName: string; role: string; }

const COLUMNS: { status: CaseStatus; title: string; hint: string }[] = [
  { status: 'referral',  title: 'Referral',  hint: 'New' },
  { status: 'workup',    title: 'Workup',    hint: 'Labs / imaging' },
  { status: 'clearance', title: 'Clearance', hint: 'Anesthesia review' },
  { status: 'pre_hab',   title: 'Pre-hab',   hint: 'Optimisation' },
  { status: 'ready',     title: 'Ready',     hint: 'Cleared for OR' },
  { status: 'completed', title: 'Completed', hint: 'Post-op' },
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}
function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CoordinatorBoardPage() {
  const me = useCurrentUser();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [providers, setProviders] = useState<Map<string, Provider>>(new Map());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [c, p, pr] = await Promise.all([
        jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
        jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
        jsonOrThrow<{ items: Provider[] }>(await fetch('/api/providers')),
      ]);
      setCases(c.items);
      const pm = new Map<string, Patient>();
      p.items.forEach((x) => pm.set(x.id, x));
      setPatients(pm);
      const prm = new Map<string, Provider>();
      pr.items.forEach((x) => prm.set(x.id, x));
      setProviders(prm);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const out: Record<CaseStatus, CaseRow[]> = {
      referral: [], workup: [], clearance: [], pre_hab: [], ready: [], completed: [], cancelled: [],
    };
    cases?.forEach((c) => {
      out[c.status].push(c);
    });
    return out;
  }, [cases]);

  const total = cases?.filter((c) => c.status !== 'cancelled').length ?? 0;

  return (
    <AppShell breadcrumbs={['Coordinator', 'Board']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            Coordinator{me ? ` · ${me.firstName} ${me.lastName}` : ''}
          </span>
          <h1>Pre-op <span className="emph">board</span>.</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', marginBottom: 12 }}>{error}</div>}

      {!cases ? (
        <div className="muted">Loading…</div>
      ) : total === 0 ? (
        <div className="card">
          <div className="muted">
            No active cases at your facility. An admin can create cases in{' '}
            <Link href="/app/admin/cases" style={{ textDecoration: 'underline' }}>admin · cases</Link>.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`,
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 12,
          }}
        >
          {COLUMNS.map((col) => {
            const items = grouped[col.status] ?? [];
            return (
              <div
                key={col.status}
                className="card"
                style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 240 }}
              >
                <div className="card-head" style={{ marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{col.title}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{col.hint}</div>
                  </div>
                  <span className="status-pill neutral" style={{ fontSize: 11 }}>{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, padding: '12px 4px' }}>—</div>
                ) : (
                  items.map((c) => {
                    const p = patients.get(c.patientId);
                    const s = c.surgeonId ? providers.get(c.surgeonId) : null;
                    return (
                      <Link
                        key={c.id}
                        href={`/app/admin/cases/${c.id}`}
                        style={{
                          display: 'block',
                          padding: 10,
                          background: 'var(--surface-100, #fff)',
                          border: '1px solid var(--border, #eaeaea)',
                          borderRadius: 8,
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span className="avatar-xs">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p ? `${p.firstName} ${p.lastName}` : c.patientId.slice(0, 8)}
                            </div>
                            <div className="muted" style={{ fontSize: 11 }}>
                              {p ? `${ageOf(p.dob)}y` : ''}
                              {s ? ` · Dr. ${s.lastName}` : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-700, #444)' }}>
                          {c.procedureDescription ?? c.procedureCode ?? 'procedure tbd'}
                        </div>
                        {c.surgeryDate && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                            Surgery {fmtDateShort(c.surgeryDate)}
                          </div>
                        )}
                        {c.readinessScore != null && (
                          <div style={{ marginTop: 6 }}>
                            <div className="readiness-bar">
                              <div className="track">
                                <div className="fill" style={{ width: `${c.readinessScore}%` }} />
                              </div>
                              <div className="val" style={{ fontSize: 11 }}>{c.readinessScore}</div>
                            </div>
                          </div>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
