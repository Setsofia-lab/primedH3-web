'use client';

/**
 * Surgeon · Schedule — calendar-style view of the current surgeon's
 * upcoming cases with surgery dates, grouped by week. Reads
 * /api/cases (server scopes to surgeon_id == me).
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

interface CaseRow {
  id: string;
  patientId: string;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  surgeryDate: string | null;
  readinessScore: number | null;
}

interface Patient { id: string; firstName: string; lastName: string; dob: string | null }

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

const STATUS_COLOR: Record<CaseStatus, string> = {
  referral: '#6B7895',
  workup: '#3B82F6',
  clearance: '#F59E0B',
  pre_hab: '#10B981',
  ready: '#10B981',
  completed: '#A3ADC4',
  cancelled: '#A3ADC4',
};

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day + 6) % 7; // Mon as start
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function fmtWeekRange(start: Date): string {
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const right = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${left} – ${right}`;
}

export default function SurgeonSchedulePage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [c, p] = await Promise.all([
          jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
          jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
        ]);
        setCases(c.items);
        setPatients(new Map(p.items.map((x) => [x.id, x])));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    if (!cases) return [];
    const upcoming = cases
      .filter((c) => c.surgeryDate && c.status !== 'completed' && c.status !== 'cancelled')
      .sort((a, b) => new Date(a.surgeryDate!).getTime() - new Date(b.surgeryDate!).getTime());

    const buckets = new Map<string, { weekStart: Date; rows: CaseRow[] }>();
    for (const c of upcoming) {
      const ws = startOfWeek(new Date(c.surgeryDate!));
      const key = ws.toISOString();
      const b = buckets.get(key) ?? { weekStart: ws, rows: [] };
      b.rows.push(c);
      buckets.set(key, b);
    }
    return [...buckets.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [cases]);

  const totalUpcoming = useMemo(() => grouped.reduce((n, g) => n + g.rows.length, 0), [grouped]);

  return (
    <AppShell breadcrumbs={['Surgeon', 'Schedule']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Schedule</span>
          <h1>Your <span className="emph">upcoming cases</span>.</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {cases == null
              ? 'Loading…'
              : totalUpcoming === 0
                ? 'No upcoming surgeries on file.'
                : `${totalUpcoming} upcoming ${totalUpcoming === 1 ? 'case' : 'cases'}.`}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/app/surgeon/new" className="btn btn-primary">New case</Link>
        </div>
      </div>

      {error && (
        <div style={{ color: '#a61b1b', fontSize: 13, marginBottom: 12 }}>
          Couldn&apos;t load schedule: {error}
        </div>
      )}

      {grouped.map(({ weekStart, rows }) => (
        <section key={weekStart.toISOString()} style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--ink-400, #6B7895)',
              margin: '0 0 12px',
            }}
          >
            Week of {fmtWeekRange(weekStart)}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((c) => {
              const p = patients.get(c.patientId);
              const sd = new Date(c.surgeryDate!);
              return (
                <Link
                  key={c.id}
                  href={`/app/surgeon/cases/${c.id}`}
                  className="card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr auto',
                    gap: 16,
                    padding: '14px 16px',
                    textDecoration: 'none',
                    color: 'inherit',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-400, #6B7895)' }}>
                      {sd.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 500 }}>
                      {sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-400, #6B7895)' }}>
                      {sd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                      {c.procedureDescription ?? c.procedureCode ?? 'Untitled procedure'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500, #4A5878)', marginTop: 2 }}>
                      {p ? `${p.firstName} ${p.lastName}` : 'Unknown patient'}
                      {p?.dob && ` · DOB ${new Date(p.dob).toLocaleDateString('en-US')}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: 'var(--surface-100, #EEF1FA)',
                        color: STATUS_COLOR[c.status],
                        fontWeight: 500,
                      }}
                    >
                      {c.status}
                    </span>
                    {c.readinessScore != null && (
                      <div style={{ fontSize: 12, color: 'var(--ink-400, #6B7895)', marginTop: 4 }}>
                        readiness {c.readinessScore}%
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </AppShell>
  );
}
