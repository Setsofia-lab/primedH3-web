import { AppShell } from '@/components/shell/AppShell';
import { PlaceholderCard } from '@/components/shell/PlaceholderCard';

export default function PatientHomePage() {
  return (
    <AppShell breadcrumbs={['PrimedHealth', 'Patient']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Patient</span>
          <h1>Patient mobile PWA</h1>
        </div>
      </div>
      <PlaceholderCard
        milestone="M9 · Up next"
        title="Patient mobile PWA"
        body="390px-optimized installable PWA: greeting + countdown + readiness ring · tasks · messages · education · timeline · appointments · profile · day-of checklist. Full PWA install on iOS Safari + Android Chrome."
      />
    </AppShell>
  );
}
