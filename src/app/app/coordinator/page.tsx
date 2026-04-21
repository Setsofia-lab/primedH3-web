import { AppShell } from '@/components/shell/AppShell';
import { PlaceholderCard } from '@/components/shell/PlaceholderCard';

export default function CoordinatorBoardPage() {
  return (
    <AppShell breadcrumbs={['PrimedHealth', 'Coordinator', 'Board']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordination</span>
          <h1>Coordinator board</h1>
        </div>
      </div>

      <PlaceholderCard
        milestone="M8 · Up next"
        title="Coordinator board"
        body="Drag cards across 6 columns: Referral · Workup · Clearance · Pre-Op · Ready · Needs Attention. Agents move cards programmatically; coordinators resolve exceptions."
        previews={[
          { n: '01', t: 'Board',           d: '6 columns; drag-and-drop with dnd-kit' },
          { n: '02', t: 'Cards',           d: 'Patient + procedure + days-to-surgery + risk' },
          { n: '03', t: 'Needs Attention', d: 'Escalation column for exceptions' },
          { n: '04', t: 'Live agent',      d: 'Agents move cards via event bus' },
        ]}
      />
    </AppShell>
  );
}
