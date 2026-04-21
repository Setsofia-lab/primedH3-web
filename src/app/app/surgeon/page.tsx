import { AppShell } from '@/components/shell/AppShell';
import { PlaceholderCard } from '@/components/shell/PlaceholderCard';

export default function SurgeonCasesPage() {
  return (
    <AppShell breadcrumbs={['PrimedHealth', 'Surgeon', 'My cases']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">My work</span>
          <h1>My cases</h1>
        </div>
      </div>

      <PlaceholderCard
        milestone="M6 · Up next"
        title="Surgeon cockpit"
        body="Case list sortable by surgery date and readiness score. Click a case to open the single-page cockpit with ASA, NSQIP, AI-drafted H&P, and the Clear-for-Surgery sign-off."
        previews={[
          { n: '01', t: 'Case list',  d: 'Sortable by surgery date or readiness score' },
          { n: '02', t: 'Cockpit',    d: 'Patient summary, ASA, NSQIP, consults, labs, imaging' },
          { n: '03', t: 'AI-drafted H&P', d: 'Editable, versioned, badge-ai pulse' },
          { n: '04', t: 'Sign-off',   d: 'Disabled until all green' },
        ]}
      />
    </AppShell>
  );
}
