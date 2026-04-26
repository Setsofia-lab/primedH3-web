/**
 * IntakeOrchestratorService — thin api-side adapter that hands off to
 * the worker via SQS.
 *
 * Phase 2 (M9 stand-in): inserted a fixed 6-task checklist inline.
 * Phase 3 (M11+M12.1): publishes an `intake_orchestrator` job to the
 * agent queue. The worker pulls it, invokes Bedrock, validates the
 * output JSON, and inserts the resulting tasks. The case-create
 * handler still returns immediately — agent runs are async.
 *
 * This file deliberately keeps the same name + onCaseCreated signature
 * so the call sites in CasesAdminController + CasesController don't
 * change.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgentDispatcherService } from '../agents/agent-dispatcher.service';
import type { Case } from '../db/schema';

@Injectable()
export class IntakeOrchestratorService {
  private readonly logger = new Logger(IntakeOrchestratorService.name);

  constructor(private readonly dispatcher: AgentDispatcherService) {}

  async onCaseCreated(caseRow: Case, _createdByUserId: string): Promise<void> {
    try {
      await this.dispatcher.dispatch({
        agentKey: 'intake_orchestrator',
        triggerEvent: 'case.created',
        caseRow,
        procedureCode: caseRow.procedureCode,
        procedureDescription: caseRow.procedureDescription,
      });
    } catch (err) {
      // Never block case creation on the agent dispatch.
      this.logger.error(
        `IntakeOrchestrator dispatch failed for case=${caseRow.id}: ${(err as Error).message}`,
      );
    }
  }
}
