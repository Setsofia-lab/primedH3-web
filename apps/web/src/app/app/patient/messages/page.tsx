'use client';

/**
 * Patient · Chat — real per-case thread for the linked patient.
 *
 * Server scopes /messages by case visibility AND by patient_visible=true,
 * so anything posted internally on the care team won't show up here.
 * Patient posts are always patient-visible (the server forces it).
 */
import { useEffect, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';
import { MessagesPanel } from '@/components/messages/MessagesPanel';

interface CaseRow { id: string; }

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export default function PatientMessagesPage() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const r = await jsonOrNull<{ items: CaseRow[] }>(await fetch('/api/me/cases'));
      setCaseId(r?.items[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          <span style={{ fontStyle: 'italic' }}>Chat</span> with your team.
        </h1>
        {loading ? (
          <div style={{ color: '#888', fontSize: 14 }}>Loading…</div>
        ) : !caseId ? (
          <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 16, fontSize: 14, color: '#555' }}>
            No surgery on file yet, so no thread to open.
          </div>
        ) : (
          <MessagesPanel caseId={caseId} hidePatientToggle />
        )}
      </div>
    </PatientShell>
  );
}
