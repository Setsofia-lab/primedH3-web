import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function SurgeonTasksPage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'Sign-offs']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Sign-offs</span>
          <h1>Pending <span className="emph">sign-offs</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Sign-off queue"
        milestone="Phase 2 · M9"
        description="AI-drafted notes (H&P, plan, post-op) that need your signature land here. Each item links to the case for context, with a single-click sign + audit event."
      />
    </AppShell>
  );
}
