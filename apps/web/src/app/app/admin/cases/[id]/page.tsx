'use client';

import { use } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { CaseCockpit } from '@/components/cases/CaseCockpit';

export default function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell breadcrumbs={['Admin', 'Cases', 'Case detail']}>
      <CaseCockpit role="admin" caseId={id} backHref="/app/admin/cases" backLabel="All cases" />
    </AppShell>
  );
}
