import { AppShell } from '@/components/shell/AppShell';
import { PlaceholderCard } from '@/components/shell/PlaceholderCard';

export default function AnesthesiaQueuePage() {
  return (
    <AppShell breadcrumbs={['PrimedHealth', 'Anesthesia', 'Queue']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Clearance</span>
          <h1>Pre-anesthesia queue</h1>
        </div>
      </div>

      <PlaceholderCard
        milestone="M7 · Up next"
        title="Pre-anesthesia clearance"
        body="Color-coded queue. AI-drafted pre-anesthesia note. Live RCRI / STOP-BANG calculators. Clear / conditional / defer decision with reason field."
        previews={[
          { n: '01', t: 'Queue',         d: 'Sorted by surgery date, color-coded by risk' },
          { n: '02', t: 'AI-drafted note', d: 'Edit-in-place, versioned' },
          { n: '03', t: 'RCRI + STOP-BANG', d: 'Live recompute as fields change' },
          { n: '04', t: 'Decision',      d: 'Clear / Conditional / Defer + reason' },
        ]}
      />
    </AppShell>
  );
}
