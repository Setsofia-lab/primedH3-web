'use client';

import { use } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { CaseCockpit } from '@/components/cases/CaseCockpit';

export default function CoordinatorCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell breadcrumbs={['Coordinator', 'Board', 'Case detail']}>
      <CaseCockpit role="coordinator" caseId={id} backHref="/app/coordinator" backLabel="Board" />
    </AppShell>
  );
}
