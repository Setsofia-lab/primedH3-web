import { AppShell } from '@/components/shell/AppShell';
import { PlaceholderCard } from '@/components/shell/PlaceholderCard';

export default function AdminDashboardPage() {
  return (
    <AppShell breadcrumbs={['PrimedHealth', 'Admin', 'Dashboard']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Health-center dashboard</h1>
        </div>
      </div>

      <PlaceholderCard
        milestone="M5 · Up next"
        title="Admin cockpit"
        body="KPI tiles · live agent activity stream · cases-by-service-line chart · agent health mini panel. Builds in M5 (next milestone) — wired against MSW fixtures."
        previews={[
          { n: '01', t: 'KPI tiles',       d: 'Active cases · at-risk · avg time-to-clearance · cancellation rate' },
          { n: '02', t: 'Activity stream', d: 'Rolling list of agent events with tool calls + status pulse' },
          { n: '03', t: 'Service-line',    d: 'Recharts horizontal bar of cases by service line' },
          { n: '04', t: 'Agent health',    d: '9 mini cards: success rate, avg latency, mock token cost' },
        ]}
      />
    </AppShell>
  );
}
