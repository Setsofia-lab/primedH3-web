/**
 * IntakeOrchestratorService — M9 stand-in.
 *
 * When a case is created, populate a default workup checklist so the
 * coordinator + clinicians have something to grab on day one. In Phase
 * 3 (Constitution §5.3) this becomes a real LangGraph agent running in
 * `apps/worker` with Bedrock + tool calls; for now it's a deterministic
 * service that runs in-process.
 *
 * Idempotent — best-effort. If task inserts fail (race, DB hiccup) we
 * log and continue; the case still gets created. The coordinator can
 * always add tasks manually.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { tasks, type Case } from '../db/schema';

interface TaskTemplate {
  title: string;
  description?: string;
  assigneeRole: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';
  /** Days from case creation, used to compute due_date. */
  dueInDays?: number;
}

const DEFAULT_TEMPLATES: readonly TaskTemplate[] = [
  {
    title: 'Pre-op labs (CBC, BMP, PT/INR)',
    description: 'Order standard pre-op lab panel.',
    assigneeRole: 'coordinator',
    dueInDays: 14,
  },
  {
    title: 'EKG',
    description: 'Resting 12-lead EKG within 30 days of surgery.',
    assigneeRole: 'coordinator',
    dueInDays: 21,
  },
  {
    title: 'Anesthesia clearance review',
    description: 'Pre-anesthesia assessment + ASA classification.',
    assigneeRole: 'anesthesia',
    dueInDays: 10,
  },
  {
    title: 'Sign H&P',
    description: 'Surgeon signs the AI-drafted history & physical.',
    assigneeRole: 'surgeon',
    dueInDays: 7,
  },
  {
    title: 'Patient education delivered',
    description: 'Send pre-op prep guide + recovery checklist to patient.',
    assigneeRole: 'coordinator',
    dueInDays: 3,
  },
  {
    title: 'Patient signs informed consent',
    description: 'Review and sign consent form for the planned procedure.',
    assigneeRole: 'patient',
    dueInDays: 7,
  },
];

@Injectable()
export class IntakeOrchestratorService {
  private readonly logger = new Logger(IntakeOrchestratorService.name);

  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  /**
   * Run on every successful case create. Best-effort.
   *
   * @param createdByUserId — the user who created the case (admin / surgeon /
   *   coordinator). Stamped on each generated task as `created_by`.
   */
  async onCaseCreated(caseRow: Case, createdByUserId: string): Promise<void> {
    const now = Date.now();
    const rows = DEFAULT_TEMPLATES.map((t) => ({
      facilityId: caseRow.facilityId,
      caseId: caseRow.id,
      title: t.title,
      description: t.description ?? null,
      status: 'pending' as const,
      assigneeRole: t.assigneeRole,
      assigneeUserId: null,
      dueDate:
        typeof t.dueInDays === 'number'
          ? new Date(now + t.dueInDays * 24 * 3600 * 1000)
          : null,
      createdBy: createdByUserId,
    }));
    try {
      await this.db.insert(tasks).values(rows);
      this.logger.log(
        `IntakeOrchestrator seeded ${rows.length} tasks for case=${caseRow.id}`,
      );
    } catch (err) {
      this.logger.error(
        `IntakeOrchestrator failed to seed tasks for case=${caseRow.id}: ${(err as Error).message}`,
      );
    }
  }
}
