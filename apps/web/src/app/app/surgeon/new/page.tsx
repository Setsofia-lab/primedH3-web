import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function SurgeonNewCasePage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'New case']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · New case</span>
          <h1>Open a <span className="emph">new case</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Self-serve case creation"
        milestone="Phase 2 · M8"
        description={
          <>
            Surgeon-driven case creation lands in M8 once the agent-assisted
            intake flow (auto-pulling chart from Athena, auto-routing to
            anesthesia) is wired. For now an admin can open a case for you —
            see <Link href="/app/admin/cases" style={{ textDecoration: 'underline' }}>admin · cases</Link>.
          </>
        }
      />
    </AppShell>
  );
}
