'use client';

/**
 * Patient · Day-of — T-minus checklist for surgery day.
 *
 * Constitution §3.6 calls this `/app/day-of`; we live under the
 * patient route group, so URL is /app/patient/day-of. Reachable from
 * the patient home anytime a case is on file (we don't gate on the
 * 24h window — the screen is genuinely useful 1-2 days out and is
 * the "what do I do tomorrow" reference).
 *
 * Content is procedure-specific:
 *   - NPO (nothing-by-mouth) cutoff
 *   - Medications to hold vs. continue (procedure category presets)
 *   - Arrival time
 *   - What to bring
 *   - Driver requirement
 *   - Day-of contact info
 *
 * All medication guidance is intentionally generic
 * ("your prescribed medications") — never names a drug or a dose
 * (NEVER_PRESCRIBE_MEDICATION hard-stop, even on patient-facing copy).
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';

interface CaseRow {
  id: string;
  procedureCode: string | null;
  procedureDescription: string | null;
  surgeryDate: string | null;
  status: string;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

interface Section {
  readonly key: string;
  readonly title: string;
  readonly items: readonly string[];
}

/** Procedure-bucket presets. Defaults to a generic outpatient schedule. */
function sectionsForProcedure(code: string | null, surgeryAtIso: string | null): readonly Section[] {
  const surgeryAt = surgeryAtIso ? new Date(surgeryAtIso) : null;
  const arrival = surgeryAt
    ? new Date(surgeryAt.getTime() - 2 * 60 * 60 * 1000)
    : null;

  const npo = surgeryAt
    ? `Nothing to eat after midnight the night before surgery (${surgeryAt.toLocaleDateString('en-US', { weekday: 'long' })}). Clear liquids OK up to 2 hours before — water, black coffee, apple juice. NO milk, juice with pulp, or food.`
    : 'Nothing to eat after midnight the night before. Clear liquids OK up to 2 hours before surgery — water, black coffee, apple juice. NO milk, juice with pulp, or food.';

  const meds = [
    'Take your usual medications with a small sip of water unless your care team told you otherwise.',
    'If you take blood thinners or diabetes medications, follow the specific instructions in your pre-op packet — your provider will have flagged what to hold and when.',
    'Bring a written list (or a phone photo) of every medication you take, including over-the-counter and herbal supplements.',
  ];

  const arrival_lines = arrival
    ? [
        `Arrive by ${arrival.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })} (2 hours before surgery).`,
        'Allow extra time for parking and check-in.',
      ]
    : [
        'Arrive 2 hours before your scheduled surgery time.',
        'Allow extra time for parking and check-in.',
      ];

  const bring = [
    'Government-issued photo ID',
    'Insurance card',
    'Pre-op paperwork from your care team',
    'List of medications + supplements',
    'Glasses or hearing aids in a labeled case',
    'CPAP machine if you use one',
    'Comfortable loose clothing for after surgery',
    'Slip-on shoes',
    'Phone charger',
  ];

  const driver = [
    'You CANNOT drive yourself home. Anesthesia stays in your system for 24 hours.',
    'Bring an adult who can drive you and stay with you for the first night.',
    'Rideshare alone is not permitted — facilities require a named adult escort.',
  ];

  // Procedure-specific tweaks. Codes are CPT-like ranges.
  const isOrtho = !!code && /^(27[0-9]{3}|29[0-9]{3})$/.test(code);
  const isBariatric = !!code && /^437/.test(code);
  const isCardiac = !!code && /^335/.test(code);

  const procedureNotes: string[] = [];
  if (isOrtho) {
    procedureNotes.push(
      'Bring a walker, crutches, or knee scooter if your provider gave you one in advance.',
      'Wear loose pants or shorts that fit over a knee/leg dressing.',
    );
  }
  if (isBariatric) {
    procedureNotes.push(
      'Continue the bariatric clear-liquid prep your nutrition team mapped out.',
      'Plan for an overnight stay — bring an overnight bag with toiletries and basic clothing.',
    );
  }
  if (isCardiac) {
    procedureNotes.push(
      'Plan for a multi-day hospital stay. Bring an overnight bag.',
      'Avoid using lotion, deodorant, or perfume the morning of surgery — these can interfere with monitoring leads.',
    );
  }
  procedureNotes.push(
    'Bathe or shower the night before AND the morning of surgery; do not apply lotion or makeup.',
  );

  return [
    { key: 'npo', title: 'Eating & drinking', items: [npo] },
    { key: 'meds', title: 'Medications', items: meds },
    { key: 'arrival', title: 'Arrival', items: arrival_lines },
    { key: 'bring', title: 'What to bring', items: bring },
    { key: 'driver', title: 'Getting home', items: driver },
    { key: 'procedure', title: 'Procedure-specific', items: procedureNotes },
  ];
}

export default function PatientDayOfPage() {
  const [primaryCase, setPrimaryCase] = useState<CaseRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const c = await jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/me/cases'));
      setPrimaryCase(c?.items[0] ?? null);
      setLoading(false);
    })();
  }, []);

  const sections = useMemo(
    () => sectionsForProcedure(primaryCase?.procedureCode ?? null, primaryCase?.surgeryDate ?? null),
    [primaryCase],
  );

  const surgeryAt = primaryCase?.surgeryDate ? new Date(primaryCase.surgeryDate) : null;
  const hoursTo = surgeryAt
    ? Math.round((surgeryAt.getTime() - Date.now()) / (60 * 60 * 1000))
    : null;

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <Link
          href="/app/patient"
          style={{
            display: 'inline-block',
            fontSize: 13,
            color: '#666',
            textDecoration: 'none',
            marginBottom: 8,
          }}
        >
          ← Back home
        </Link>

        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 4, marginTop: 0 }}>
          Day-of <span style={{ fontStyle: 'italic' }}>checklist</span>.
        </h1>

        {primaryCase ? (
          <p style={{ color: '#555', fontSize: 14, marginTop: 0, marginBottom: 16 }}>
            {primaryCase.procedureDescription ?? 'Your procedure'}
            {surgeryAt && (
              <>
                {' '}— {surgeryAt.toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {hoursTo != null && hoursTo >= 0 && hoursTo <= 48 && (
                  <strong> · T-minus {hoursTo}h</strong>
                )}
              </>
            )}
          </p>
        ) : (
          <p style={{ color: '#555', fontSize: 14, marginTop: 0 }}>
            No upcoming surgery on file. Your care team will populate this when one is scheduled.
          </p>
        )}

        {loading && <div style={{ color: '#888', fontSize: 14 }}>Loading your checklist…</div>}

        {!loading && primaryCase && (
          <>
            <div
              style={{
                background: '#fff7e6',
                border: '1px solid #f5cc66',
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                color: '#5c3d00',
                marginBottom: 16,
              }}
            >
              <strong>Emergency or unsure?</strong> Call your care team or go to the nearest
              emergency department. Don&apos;t wait if something feels wrong.
            </div>

            {sections.map((s) => (
              <section
                key={s.key}
                style={{
                  background: '#f6f7fa',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    margin: '0 0 8px',
                    color: '#1a1a1a',
                  }}
                >
                  {s.title}
                </h2>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {s.items.map((it, i) => (
                    <li
                      key={`${s.key}-${i}`}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        fontSize: 14,
                        color: '#333',
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: '#4B6BEF', flexShrink: 0 }} aria-hidden="true">•</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p style={{ color: '#888', fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
              These instructions are AI-drafted from your procedure type and reviewed by your
              care team. Anything specific to you — like medications to hold — comes from your
              provider, not this app. If anything here conflicts with what your team told you,
              follow your team.
            </p>
          </>
        )}
      </div>
    </PatientShell>
  );
}
