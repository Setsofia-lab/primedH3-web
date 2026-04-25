import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function SurgeonSchedulePage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'Schedule']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Schedule</span>
          <h1>Your <span className="emph">OR schedule</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="OR schedule + block-time view"
        milestone="Phase 2 · M8"
        description="A calendar view of your booked OR time + per-case status, sourced from cases.surgery_date and Athena Appointment once those scopes are granted on the partner side. For now, see your case list for surgery dates."
      />
    </AppShell>
  );
}
