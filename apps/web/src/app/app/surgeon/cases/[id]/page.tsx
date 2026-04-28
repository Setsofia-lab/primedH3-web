'use client';

import { use } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { CaseCockpit } from '@/components/cases/CaseCockpit';

export default function SurgeonCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell breadcrumbs={['Surgeon', 'My cases', 'Case detail']}>
      <CaseCockpit role="surgeon" caseId={id} backHref="/app/surgeon" backLabel="All cases" />
    </AppShell>
  );
}
