import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function CoordinatorMessagesPage() {
  return (
    <AppShell breadcrumbs={['Coordinator', 'Messages']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Messages</span>
          <h1>Inbox &amp; <span className="emph">case threads</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Coordinator inbox"
        milestone="Phase 2 · M9"
        description="Patient SMS threads (drafted by PatientCommsAgent, approved here) plus internal threads with surgeons / anesthesia, all keyed by case."
      />
    </AppShell>
  );
}
