'use client';

import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function AdminAgentsPage() {
  return (
    <AppShell breadcrumbs={['Admin', 'Agents']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Agents</span>
          <h1>AI orchestration <span className="emph">control plane</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Agent runtime + observability"
        milestone="Phase 2 · M9"
        description={
          <>
            This page will list every agent (IntakeOrchestrator, RiskScreening,
            AnesthesiaClearance, ReferralAgent, PatientComms, Readiness,
            Documentation, TaskTracker, plus the orchestrator), with health,
            p50/p95 latency, runs/24h, model + version, and a drill-down to a
            stream of recent runs.
          </>
        }
        tracking={
          <>
            Tracked in: ADR (TBD), Constitution §4 “Agents”. The data model
            (<code>agent_runs</code>, <code>agent_prompt_versions</code>) lands
            with the worker service in M9.
          </>
        }
      />
    </AppShell>
  );
}
