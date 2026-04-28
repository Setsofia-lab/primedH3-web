'use client';

/**
 * Surgeon · Schedule — Phase-1 calendar grid restored.
 *
 *   page-head             ← Week / Week →
 *   ai-banner             week range · room · cases scheduled
 *   cal-grid              Time × Mon–Fri grid; each surgeryDate
 *                         lands in the closest of 4 time rows.
 *   stats-row             Next open block · This-week stats
 *
 * Data is real:
 *   - /api/cases           role-scoped to surgeon_id == me on the api side
 *   - /api/patients        used to label book cells with patient names
 *
 * Cells:
 *   book  = a real case at this slot. Click to open the cockpit.
 *   hold  = (visual reserved tile — surfaces if/when block-hold lands)
 *   empty = open slot. Click "Assign a case" on the side panel to fill.
 */
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';

type CaseStatus =
  | 'referral'
  | 'intake'
  | 'workup'
  | 'clearance'
  | 'pre_op'
  | 'surgery'
  | 'completed'
  | 'cancelled';

interface CaseRow {
  id: string;
  patientId: string;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: CaseStatus;
  surgeryDate: string | null;
  readinessScore: number | null;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string | null;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/* Mon-anchored week start. */
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day + 6) % 7;
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function fmtDayHeader(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* Time rows match the original Phase-1 prototype. */
const SLOTS: Array<{ label: string; hour: number; minute: number }> = [
  { label: '7:30a', hour: 7, minute: 30 },
  { label: '9:30a', hour: 9, minute: 30 },
  { label: '12:00p', hour: 12, minute: 0 },
  { label: '2:00p', hour: 14, minute: 0 },
];

/** Bucket a Date into the nearest SLOTS row. */
function rowFor(d: Date): number {
  const minutes = d.getHours() * 60 + d.getMinutes();
  let best = 0;
  let bestDelta = Infinity;
  SLOTS.forEach((s, i) => {
    const m = s.hour * 60 + s.minute;
    const delta = Math.abs(m - minutes);
    if (delta < bestDelta) {
      best = i;
      bestDelta = delta;
    }
  });
  return best;
}

/** Default duration when a case has no explicit duration on it yet. */
function durationFor(c: CaseRow): number {
  // Heuristic: most knee/hip = 180min, hernia/lap = 90min, otherwise 90.
  const proc = `${c.procedureCode ?? ''} ${c.procedureDescription ?? ''}`.toLowerCase();
  if (/tka|knee|hip|tha/.test(proc)) return 180;
  if (/cabg|spine|fusion/.test(proc)) return 240;
  if (/thyroid|cole|hernia|lap/.test(proc)) return 90;
  return 90;
}

export default function SurgeonSchedulePage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patientById, setPatientById] = useState<Map<string, Patient>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // weeks from "this Monday"

  useEffect(() => {
    void (async () => {
      try {
        const [c, p] = await Promise.all([
          jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/cases?limit=200')),
          jsonOrNull<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
        ]);
        setCases(c?.items ?? []);
        setPatientById(new Map((p?.items ?? []).map((x) => [x.id, x])));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const weekStart = useMemo(() => {
    const ws = startOfWeek(new Date());
    return addDays(ws, weekOffset * 7);
  }, [weekOffset]);

  const days = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  /* Build a 4×5 grid of either null (empty) or the case at that slot. */
  const grid = useMemo(() => {
    const g: Array<Array<CaseRow | null>> = SLOTS.map(() => Array(5).fill(null));
    if (!cases) return g;
    const weekEnd = addDays(weekStart, 5);
    for (const c of cases) {
      if (!c.surgeryDate) continue;
      if (c.status === 'cancelled') continue;
      const d = new Date(c.surgeryDate);
      if (d < weekStart || d >= weekEnd) continue;
      const dayIdx = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 3600 * 1000));
      if (dayIdx < 0 || dayIdx > 4) continue;
      const row = rowFor(d);
      // If two cases land in the same slot, the later-created wins.
      g[row]![dayIdx] = c;
    }
    return g;
  }, [cases, weekStart]);

  const stats = useMemo(() => {
    if (!cases) return { cases: 0, hours: 0, util: 0, cancels: 0 };
    const weekEnd = addDays(weekStart, 7);
    const inWeek = cases.filter(
      (c) =>
        c.surgeryDate &&
        new Date(c.surgeryDate) >= weekStart &&
        new Date(c.surgeryDate) < weekEnd,
    );
    const active = inWeek.filter((c) => c.status !== 'cancelled');
    const hours = active.reduce((s, c) => s + durationFor(c), 0) / 60;
    const cancels = inWeek.filter((c) => c.status === 'cancelled').length;
    // Util = booked OR-hours / 9.5h block × 5 days = 47.5h
    const util = Math.min(100, Math.round((hours / 47.5) * 100));
    return { cases: active.length, hours, util, cancels };
  }, [cases, weekStart]);

  /* Find the first empty slot in the week-grid for "Next open block". */
  const nextOpen = useMemo<{ day: Date; slot: (typeof SLOTS)[number] } | null>(() => {
    let found: { day: Date; slot: (typeof SLOTS)[number] } | null = null;
    SLOTS.forEach((slot, r) => {
      const row = grid[r];
      if (!row) return;
      row.forEach((cell, d) => {
        const day = days[d];
        if (found || cell || !day) return;
        found = { day, slot };
      });
    });
    return found;
  }, [grid, days]);

  const weekRange = `${fmtMonthDay(weekStart)} — ${fmtMonthDay(addDays(weekStart, 4))}`;

  return (
    <AppShell breadcrumbs={['Surgeon', 'Schedule']}>
      <style jsx>{`
        .cal-grid {
          display: grid;
          grid-template-columns: 70px repeat(5, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .cal-grid .h {
          background: var(--surface-50, #fafafa);
          padding: 0.625rem 0.875rem;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-500);
        }
        .cal-grid .time {
          background: var(--surface-50, #fafafa);
          padding: 1rem 0.875rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--ink-500);
        }
        .cal-grid .c {
          background: #fff;
          min-height: 88px;
          padding: 0.625rem 0.75rem;
          font-size: 0.8125rem;
        }
        .cal-grid .c.book {
          background: var(--primary-blue-50, #eef1ff);
          border-left: 3px solid var(--primary-blue);
          color: var(--ink-900);
          text-decoration: none;
          display: block;
          transition: filter 0.15s ease;
        }
        .cal-grid .c.book:hover {
          filter: brightness(0.97);
        }
        .cal-grid .c.book .pt {
          font-weight: 600;
          margin-bottom: 2px;
        }
        .cal-grid .c.book .pr {
          font-size: 0.75rem;
          color: var(--ink-700);
        }
        .cal-grid .c.hold {
          background: var(--surface-100);
          color: var(--ink-500);
          font-style: italic;
        }
        .stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .stat-lbl {
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: var(--ink-500);
          letter-spacing: 0.06em;
        }
        .stat-val {
          font-family: var(--font-display, inherit);
          font-size: 1.5rem;
          font-feature-settings: 'ss01', 'cv11';
        }
      `}</style>

      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Schedule</span>
          <h1>
            OR <span className="emph">block</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-outline-dark"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            ← Week
          </button>
          <button
            type="button"
            className="btn btn-outline-dark"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            Week →
          </button>
        </div>
      </div>

      <div className="ai-banner">
        <b>{weekRange}</b> · {stats.cases} {stats.cases === 1 ? 'case' : 'cases'} scheduled
        {stats.cancels > 0 && `, ${stats.cancels} cancelled`}.
      </div>

      {error && (
        <div style={{ color: 'var(--danger, #c0392b)', margin: '0 0 12px' }}>{error}</div>
      )}

      <div className="cal-grid">
        <div className="h">Time</div>
        {days.map((d) => (
          <div className="h" key={d.toISOString()}>{fmtDayHeader(d)}</div>
        ))}

        {SLOTS.map((slot, rowIdx) => (
          <div key={slot.label} style={{ display: 'contents' }}>
            <div className="time">{slot.label}</div>
            {days.map((_, dayIdx) => {
              const c = grid[rowIdx]![dayIdx];
              if (!c) {
                return <div className="c" key={dayIdx} />;
              }
              const p = patientById.get(c.patientId);
              const name = p ? `${p.firstName} ${p.lastName}` : 'Patient';
              const proc =
                c.procedureDescription ??
                c.procedureCode ??
                'Procedure';
              const dur = durationFor(c);
              return (
                <Link
                  key={dayIdx}
                  href={`/app/surgeon/cases/${c.id}`}
                  className="c book"
                >
                  <div className="pt">{name}</div>
                  <div className="pr">
                    {proc} · {dur}min
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="stats-row">
        <div className="card">
          <div className="card-head"><h3>Next open block</h3></div>
          <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)' }}>
            {nextOpen ? (
              <>
                <b>
                  {nextOpen.day.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {nextOpen.slot.label}
                </b>
                <br />
                <span style={{ color: 'var(--ink-500)' }}>
                  Open slot · click an empty cell to assign
                </span>
                <br />
                <Link
                  href="/app/surgeon/new"
                  className="btn btn-primary"
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8125rem',
                    display: 'inline-block',
                  }}
                >
                  Assign a case
                </Link>
              </>
            ) : (
              <span className="muted">Week is fully booked.</span>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>This week</h3></div>
          <div className="stat-grid">
            <div>
              <div className="stat-lbl">CASES</div>
              <div className="stat-val">{stats.cases}</div>
            </div>
            <div>
              <div className="stat-lbl">OR HOURS</div>
              <div className="stat-val">{stats.hours.toFixed(1)}</div>
            </div>
            <div>
              <div className="stat-lbl">UTIL</div>
              <div className="stat-val">{stats.util}%</div>
            </div>
            <div>
              <div className="stat-lbl">CANCELS</div>
              <div className="stat-val">{stats.cancels}</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
