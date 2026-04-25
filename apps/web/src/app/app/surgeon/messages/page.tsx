import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function SurgeonMessagesPage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'Messages']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Messages</span>
          <h1>Inbox &amp; <span className="emph">case threads</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="In-app messaging"
        milestone="Phase 2 · M9"
        description="Per-case threaded messaging between surgeon, coordinator, anesthesia, and patient. Messages get the same audit trail as PHI access (Constitution §7) and link back to the case."
      />
    </AppShell>
  );
}
