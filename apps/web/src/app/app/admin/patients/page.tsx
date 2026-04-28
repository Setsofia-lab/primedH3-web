'use client';

/**
 * Admin · Patients — same UI as /app/coordinator/patients (shared
 * PatientsDirectory). Only the breadcrumbs + eyebrow change so the
 * topbar reflects the role. Admins land on the admin-scoped case
 * detail when they click a row.
 */
import { PatientsDirectory } from '@/components/people/PatientsDirectory';

export default function AdminPatientsPage() {
  return (
    <PatientsDirectory
      breadcrumbs={['Admin', 'Patients']}
      eyebrow="Admin · Patients"
      caseHref={(id) => `/app/admin/cases/${id}`}
    />
  );
}
