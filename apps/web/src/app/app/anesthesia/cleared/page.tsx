'use client';

/**
 * Anesthesia · Cleared — cases at status=ready (cleared for OR).
 */
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { CaseList } from '../_lib/CaseList';

interface CaseRow {
  id: string; patientId: string; surgeonId: string | null;
  procedureCode: string | null; procedureDescription: string | null;
  status: string; readinessScore: number | null; surgeryDate: string | null;
}
interface Patient { id: string; firstName: string; lastName: string; dob: string; }
interface Provider { id: string; firstName: string; lastName: string; role: string; }

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export default function AnesthesiaClearedPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [providers, setProviders] = useState<Map<string, Provider>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [c, p, pr] = await Promise.all([
          jsonOrThrow<{ items: CaseRow[] }>(await fetch('/api/cases?status=ready&limit=200')),
          jsonOrThrow<{ items: Patient[] }>(await fetch('/api/patients?limit=200')),
          jsonOrThrow<{ items: Provider[] }>(await fetch('/api/providers')),
        ]);
        setCases(c.items);
        const pm = new Map<string, Patient>(); p.items.forEach((x) => pm.set(x.id, x)); setPatients(pm);
        const prm = new Map<string, Provider>(); pr.items.forEach((x) => prm.set(x.id, x)); setProviders(prm);
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  return (
    <AppShell breadcrumbs={['Anesthesia', 'Cleared']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Cleared</span>
          <h1>Ready for <span className="emph">OR</span>.</h1>
        </div>
      </div>
      <CaseList
        cases={cases}
        patients={patients}
        providers={providers}
        error={error}
        emptyMessage="No cleared cases yet."
      />
    </AppShell>
  );
}
