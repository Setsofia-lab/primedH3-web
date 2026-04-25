'use client';

/**
 * Patient · Documents — patient-visible documents on the linked case.
 * Server scopes /documents by case visibility AND patient_visible=true,
 * so the patient only sees what their care team chose to share.
 */
import { useEffect, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';

type DocumentKind =
  | 'consent' | 'lab' | 'imaging' | 'history' | 'discharge' | 'education' | 'other';

interface DocumentRow {
  id: string;
  caseId: string;
  name: string;
  contentType: string;
  sizeBytes: number | null;
  kind: DocumentKind;
  createdAt: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

const KIND_LABELS: Record<DocumentKind, string> = {
  consent: 'Consent form',
  lab: 'Lab results',
  imaging: 'Imaging',
  history: 'History',
  discharge: 'Discharge',
  education: 'Education',
  other: 'Document',
};

export default function PatientEducationPage() {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await jsonOrThrow<{ items: DocumentRow[] }>(
        await fetch('/api/documents?limit=200'),
      );
      setDocs(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void load(); }, []);

  async function open(d: DocumentRow) {
    setBusyId(d.id);
    try {
      const r = await jsonOrThrow<{ url: string }>(
        await fetch(`/api/documents/${d.id}/download-url`),
      );
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          Your <span style={{ fontStyle: 'italic' }}>documents</span>.
        </h1>
        {error && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!docs ? (
          <div style={{ color: '#888', fontSize: 14 }}>Loading…</div>
        ) : docs.length === 0 ? (
          <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 16, fontSize: 14, color: '#555' }}>
            Nothing for you yet. Your care team will share consent forms,
            prep guides, and your discharge summary here as your surgery
            approaches.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => void open(d)}
                disabled={busyId === d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  background: '#f6f7fa',
                  borderRadius: 12,
                  border: 'none',
                  cursor: busyId === d.id ? 'wait' : 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#4B6BEF',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  📄
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {KIND_LABELS[d.kind]} · {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: busyId === d.id ? '#888' : '#4B6BEF' }}>
                  {busyId === d.id ? '…' : 'Open'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
