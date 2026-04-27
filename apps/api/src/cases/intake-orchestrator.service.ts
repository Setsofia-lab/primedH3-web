/**
 * IntakeOrchestratorService — thin api-side adapter that fans the
 * `case.created` lifecycle event out to the agents that respond to it.
 * The name is a holdover from M9 when only Intake fired; it now also
 * triggers Risk + Readiness. We'll rename to CaseLifecycleService once
 * we have callers in 4+ places.
 *
 * Phase 2 (M9 stand-in): inserted a fixed 6-task checklist inline.
 * Phase 3 (M11): publishes an `intake_orchestrator` job to SQS.
 * Phase 3 (M12.2-3): also dispatches `risk_screening` + `readiness`.
 *
 * Each dispatch is wrapped in its own try/catch — one failed dispatch
 * never blocks the others, and the case create handler still returns
 * immediately.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  AgentDispatcherService,
  type AgentKey,
} from '../agents/agent-dispatcher.service';
import type { Case } from '../db/schema';

const ON_CREATE_AGENTS: readonly AgentKey[] = [
  'intake_orchestrator',
  'risk_screening',
  'anesthesia_clearance',
  'pre_hab',
  'readiness',
];

@Injectable()
export class IntakeOrchestratorService {
  private readonly logger = new Logger(IntakeOrchestratorService.name);

  constructor(private readonly dispatcher: AgentDispatcherService) {}

  async onCaseCreated(caseRow: Case, _createdByUserId: string): Promise<void> {
    await Promise.all(
      ON_CREATE_AGENTS.map((agentKey) => this.dispatchSafe(agentKey, 'case.created', caseRow)),
    );
  }

  /**
   * Re-run readiness when something the score depends on flipped.
   * Used by tasks.controller.ts on task status updates.
   */
  async onCaseChanged(caseRow: Case, triggerEvent: string): Promise<void> {
    await this.dispatchSafe('readiness', triggerEvent, caseRow);
  }

  private async dispatchSafe(
    agentKey: AgentKey,
    triggerEvent: string,
    caseRow: Case,
  ): Promise<void> {
    try {
      await this.dispatcher.dispatch({
        agentKey,
        triggerEvent,
        caseRow,
        procedureCode: caseRow.procedureCode,
        procedureDescription: caseRow.procedureDescription,
      });
    } catch (err) {
      this.logger.error(
        `${agentKey} dispatch (${triggerEvent}) failed for case=${caseRow.id}: ${(err as Error).message}`,
      );
    }
  }
}
