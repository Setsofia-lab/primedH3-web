'use client';

import { AppShell } from '@/components/shell/AppShell';
import { NotYetBuilt } from '@/components/shell/NotYetBuilt';

export default function AdminPromptsPage() {
  return (
    <AppShell breadcrumbs={['Admin', 'Prompt editor']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Prompt editor</span>
          <h1>Versioned <span className="emph">prompt</span> control.</h1>
        </div>
      </div>

      <NotYetBuilt
        title="Prompt versioning + experimentation"
        milestone="Phase 2 · M9"
        description={
          <>
            Every agent's system + tool prompts will live in
            <code>agent_prompt_versions</code>, content-hashed and tagged. This
            page lets admins draft a new version, A/B it against the live one
            for a percentage of runs, see the diff, and promote or roll back.
            Cuts over once the worker (M9) is reading prompts from the DB
            instead of code.
          </>
        }
        tracking={<>Tracked in: Constitution §4 (Agents), §11 (LLM ops).</>}
      />
    </AppShell>
  );
}
