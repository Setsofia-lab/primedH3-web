'use client';

import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function AdminAuditPage() {
  return (
    <AppShell breadcrumbs={['Admin', 'Audit log']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Audit log</span>
          <h1>Every privileged action, <span className="emph">searchable</span>.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Audit event stream"
        milestone="Phase 2 · M8"
        description={
          <>
            Every PHI-touching call (auth, hydrate, case mutation, prompt edit,
            user invite, etc.) is captured in <code>audit_events</code> with
            actor, target, IP, request id, and a JSON diff. CloudTrail data
            events on Aurora + S3 give us cross-cutting infra coverage. This
            page surfaces the merged stream with filters by actor, action,
            and resource.
          </>
        }
        tracking={<>Tracked in: Constitution §7 (HIPAA logging), §9.</>}
      />
    </AppShell>
  );
}
