'use client';

/**
 * Patient · Journey — visual case timeline derived from the case status.
 *
 * Maps the case_status enum to a 5-stage journey so patients see
 * progress at a glance:
 *   referral / workup → "Workup"
 *   clearance         → "Clearance"
 *   pre_hab           → "Pre-hab"
 *   ready             → "Ready"
 *   completed         → "Surgery"
 */
import { useEffect, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';

type CaseStatus =
  | 'referral' | 'workup' | 'clearance' | 'pre_hab' | 'ready' | 'completed' | 'cancelled';

interface CaseRow {
  id: string;
  status: CaseStatus;
  procedureDescription: string | null;
  surgeryDate: string | null;
  readinessScore: number | null;
}

const STAGES: Array<{ key: string; title: string; matches: CaseStatus[] }> = [
  { key: 'referral',  title: 'Referred',  matches: ['referral'] },
  { key: 'workup',    title: 'Workup',    matches: ['workup'] },
  { key: 'clearance', title: 'Clearance', matches: ['clearance'] },
  { key: 'pre_hab',   title: 'Pre-hab',   matches: ['pre_hab'] },
  { key: 'ready',     title: 'Ready',     matches: ['ready'] },
  { key: 'surgery',   title: 'Surgery',   matches: ['completed'] },
];

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export default function PatientTimelinePage() {
  const [c, setC] = useState<CaseRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const r = await jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/me/cases'));
      setC(r?.items[0] ?? null);
      setLoading(false);
    })();
  }, []);

  const currentIndex = c
    ? STAGES.findIndex((s) => s.matches.includes(c.status))
    : -1;

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          Your <span style={{ fontStyle: 'italic' }}>journey</span>.
        </h1>

        {loading ? (
          <div style={{ color: '#888', fontSize: 14 }}>Loading…</div>
        ) : !c ? (
          <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 16, fontSize: 14, color: '#555' }}>
            No surgery on file yet.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20, fontSize: 13, color: '#555' }}>
              {c.procedureDescription ?? 'Your procedure'}
              {c.surgeryDate && (
                <> · {new Date(c.surgeryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {STAGES.map((stage, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                const isLast = i === STAGES.length - 1;
                return (
                  <div key={stage.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Dot + line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: done ? '#4B6BEF' : active ? '#fff' : '#f0f2f5',
                          border: active ? '3px solid #4B6BEF' : '1.5px solid #d5dae0',
                          flexShrink: 0,
                        }}
                      />
                      {!isLast && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            background: done ? '#4B6BEF' : '#e3e6eb',
                            minHeight: 32,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 22, paddingTop: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: active ? 600 : 500,
                          color: done || active ? 'var(--ink-900, #1a1a1a)' : '#999',
                        }}
                      >
                        {stage.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {done ? 'Completed' : active ? 'In progress' : 'Coming up'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PatientShell>
  );
}
