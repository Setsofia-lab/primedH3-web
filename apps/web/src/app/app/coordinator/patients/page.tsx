'use client';

/**
 * Coordinator · Patients — same UI as /app/admin/patients (shared
 * PatientsDirectory). The two routes are required to render
 * pixel-identical UI; only the topbar role differs.
 */
import { PatientsDirectory } from '@/components/people/PatientsDirectory';

export default function CoordinatorPatientsPage() {
  return (
    <PatientsDirectory
      breadcrumbs={['Coordinator', 'Patients']}
      eyebrow="Coordinator · Patients"
      caseHref={(id) => `/app/coordinator/cases/${id}`}
    />
  );
}
