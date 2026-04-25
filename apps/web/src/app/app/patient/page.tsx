'use client';

/**
 * Patient · Home — real data scoped to the logged-in patient.
 *
 * Reads /me/patient + /me/cases + /me/tasks. Shows the upcoming case,
 * readiness, and the next workup task that's theirs.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
}
interface CaseRow {
  id: string;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: string;
  readinessScore: number | null;
  surgeryDate: string | null;
}
interface Task {
  id: string;
  caseId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  dueDate: string | null;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function daysTo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default function PatientHomePage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [primaryCase, setPrimaryCase] = useState<CaseRow | null>(null);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, c, t] = await Promise.all([
        jsonOrNull<Patient>(await fetch('/api/me/patient')),
        jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/me/cases')),
        jsonOrNull<{ items: Task[] }>(await fetch('/api/me/tasks')),
      ]);
      setPatient(p);
      setPrimaryCase(c?.items[0] ?? null);
      setOpenTasks((t?.items ?? []).filter((x) => x.status !== 'done'));
      setLoading(false);
      if (!p) setError('Your account isn\'t linked to a patient record yet. Ask your care team.');
    })();
  }, []);

  const ready = primaryCase?.readinessScore ?? 0;
  const dueIn = daysTo(primaryCase?.surgeryDate ?? null);

  if (loading) {
    return (
      <PatientShell>
        <div style={{ padding: 20, color: '#666' }}>Loading…</div>
      </PatientShell>
    );
  }

  if (!patient || !primaryCase) {
    return (
      <PatientShell>
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, marginBottom: 12 }}>
            Welcome{patient ? `, ${patient.firstName}` : ''}.
          </h2>
          {error && <p style={{ color: '#888', fontSize: 14 }}>{error}</p>}
          {!error && (
            <p style={{ color: '#888', fontSize: 14 }}>
              No upcoming surgery on file. Your care team will set this up shortly.
            </p>
          )}
        </div>
      </PatientShell>
    );
  }

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 4 }}>
            Hi, {patient.firstName}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.2, margin: 0 }}>
            {primaryCase.procedureDescription ?? 'Your upcoming surgery'}
          </h1>
          {primaryCase.surgeryDate && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
              {new Date(primaryCase.surgeryDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {dueIn != null && ` · in ${dueIn} day${dueIn === 1 ? '' : 's'}`}
            </div>
          )}
        </div>

        {/* Readiness ring */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4B6BEF 0%, #7C8FFF 100%)',
            color: '#fff',
            borderRadius: 16,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85, marginBottom: 8 }}>
            Readiness
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 42, fontWeight: 500, lineHeight: 1 }}>{ready}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.25)',
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${ready}%`,
                    background: '#fff',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {ready >= 85
                  ? "You're ready for surgery."
                  : ready >= 60
                  ? 'A few items left to complete.'
                  : 'Your team is working through your prep.'}
              </div>
            </div>
          </div>
        </div>

        {/* Open tasks summary */}
        <div style={{ marginBottom: 12, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>
          Up next
        </div>
        {openTasks.length === 0 ? (
          <div
            style={{
              background: '#f6f7fa',
              borderRadius: 12,
              padding: 16,
              fontSize: 14,
              color: '#555',
            }}
          >
            Nothing for you right now. Your care team will message you when something needs doing.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openTasks.slice(0, 4).map((t) => (
              <Link
                key={t.id}
                href="/app/patient/tasks"
                style={{
                  background: '#f6f7fa',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  color: 'inherit',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: t.dueDate && new Date(t.dueDate) < new Date() ? '#e74c3c' : '#4B6BEF',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{t.title}</span>
                {t.dueDate && (
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </Link>
            ))}
            {openTasks.length > 4 && (
              <Link
                href="/app/patient/tasks"
                style={{ fontSize: 13, color: '#4B6BEF', textDecoration: 'none', textAlign: 'center', padding: 8 }}
              >
                See all {openTasks.length} →
              </Link>
            )}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
