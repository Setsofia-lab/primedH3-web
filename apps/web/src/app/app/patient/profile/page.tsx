'use client';

/**
 * Patient · Me — basic identity + sign-out. PHI fields shown read-only;
 * editing flows + insurance + emergency contacts land in M8.
 */
import { useEffect, useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';
import { useCurrentUser } from '@/lib/auth/use-current-user';

interface Patient {
  firstName: string;
  lastName: string;
  dob: string;
  sex: string | null;
  mrn: string | null;
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export default function PatientProfilePage() {
  const me = useCurrentUser();
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await jsonOrNull<Patient>(await fetch('/api/me/patient'));
      setPatient(r);
    })();
  }, []);

  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          Your <span style={{ fontStyle: 'italic' }}>profile</span>.
        </h1>

        <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Row label="Name">
            {patient ? `${patient.firstName} ${patient.lastName}` : me ? `${me.firstName} ${me.lastName}` : '—'}
          </Row>
          <Row label="Email">{me?.email ?? '—'}</Row>
          {patient && (
            <>
              <Row label="DOB">{patient.dob}</Row>
              <Row label="Sex">{patient.sex ?? '—'}</Row>
              <Row label="MRN">{patient.mrn ?? '—'}</Row>
            </>
          )}
        </div>

        <a
          href="/api/auth/signout"
          style={{
            display: 'block',
            textAlign: 'center',
            background: '#fff',
            border: '1px solid #d5dae0',
            borderRadius: 12,
            padding: 14,
            fontSize: 14,
            color: '#e74c3c',
            textDecoration: 'none',
          }}
        >
          Sign out
        </a>
      </div>
    </PatientShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e3e6eb', fontSize: 14 }}>
      <div style={{ color: '#888' }}>{label}</div>
      <div style={{ textAlign: 'right' }}>{children}</div>
    </div>
  );
}
