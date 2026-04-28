'use client';

import { use } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { CaseCockpit } from '@/components/cases/CaseCockpit';

export default function AnesthesiaCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell breadcrumbs={['Anesthesia', 'Case detail']}>
      <CaseCockpit role="anesthesia" caseId={id} backHref="/app/anesthesia" backLabel="Queue" />
    </AppShell>
  );
}
