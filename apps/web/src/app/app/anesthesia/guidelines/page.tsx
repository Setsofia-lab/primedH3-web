import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function AnesthesiaGuidelinesPage() {
  return (
    <AppShell breadcrumbs={['Anesthesia', 'Guidelines']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Guidelines</span>
          <h1>Reference <span className="emph">protocols</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Practice-level guidelines"
        milestone="Phase 2 · M9"
        description="ASA-keyed protocols (anticoagulation hold, OSA risk, etc.) + per-facility overrides, surfaced inline on the case detail view by RiskScreeningAgent."
      />
    </AppShell>
  );
}
