/**
 * AgentDispatcherService — api side.
 *
 * Pre-creates an `agent_runs` row (status=queued) and publishes an
 * SQS message; the worker picks it up and updates the row to
 * running/succeeded/failed. We pre-create the row so that the case
 * detail page can show "queued" runs immediately even before the
 * worker dequeues.
 *
 * If AGENT_QUEUE_URL is unset (local dev), we still pre-create the
 * row but skip the SQS publish — useful when iterating on agent code
 * locally with no AWS access.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/config.module';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { agentRuns, type Case } from '../db/schema';

export type AgentKey =
  | 'intake_orchestrator'
  | 'risk_screening'
  | 'anesthesia_clearance'
  | 'referral'
  | 'scheduling'
  | 'patient_comms'
  | 'pre_hab'
  | 'documentation'
  | 'task_tracker'
  | 'readiness';

export interface DispatchInput {
  readonly agentKey: AgentKey;
  readonly triggerEvent: string;
  readonly caseRow: Case;
  readonly procedureCode?: string | null;
  readonly procedureDescription?: string | null;
  readonly payload?: Record<string, unknown>;
}

interface AgentMessage {
  readonly runId: string;
  readonly agentId: AgentKey;
  readonly triggerEvent: string;
  readonly context: {
    caseId: string;
    facilityId: string;
    patientId: string;
    procedureCode?: string | null;
    procedureDescription?: string | null;
    surgeonId?: string | null;
  };
  readonly payload: Record<string, unknown>;
  readonly publishedAt: number;
}

@Injectable()
export class AgentDispatcherService {
  private readonly logger = new Logger(AgentDispatcherService.name);
  private readonly sqs: SQSClient;
  private readonly queueUrl: string | undefined;

  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const region = this.config.get('AWS_REGION', { infer: true }) ?? 'us-east-1';
    this.sqs = new SQSClient({ region });
    this.queueUrl = this.config.get('AGENT_QUEUE_URL', { infer: true }) ?? undefined;
    if (!this.queueUrl) {
      this.logger.warn(
        'AGENT_QUEUE_URL not set — AgentDispatcher will log dispatches but not publish.',
      );
    }
  }

  /**
   * Pre-create the run row and publish to SQS. Best-effort: failures
   * are logged + the run row is left as `failed`, but the calling
   * domain mutation (case create, etc.) is never blocked.
   */
  async dispatch(input: DispatchInput): Promise<{ runId: string }> {
    const runId = randomUUID();
    try {
      await this.db.insert(agentRuns).values({
        id: runId,
        agentKey: input.agentKey,
        triggerEvent: input.triggerEvent,
        caseId: input.caseRow.id,
        facilityId: input.caseRow.facilityId,
        status: 'queued',
        inputJson: {
          procedureCode: input.procedureCode ?? null,
          procedureDescription: input.procedureDescription ?? null,
          payload: input.payload ?? {},
        },
      });
    } catch (err) {
      this.logger.error(`agent_runs pre-insert failed: ${(err as Error).message}`);
      return { runId };
    }

    const message: AgentMessage = {
      runId,
      agentId: input.agentKey,
      triggerEvent: input.triggerEvent,
      context: {
        caseId: input.caseRow.id,
        facilityId: input.caseRow.facilityId,
        patientId: input.caseRow.patientId,
        procedureCode: input.procedureCode ?? null,
        procedureDescription: input.procedureDescription ?? null,
        surgeonId: input.caseRow.surgeonId ?? null,
      },
      payload: input.payload ?? {},
      publishedAt: Date.now(),
    };

    if (!this.queueUrl) {
      this.logger.log(
        `[no-queue] would dispatch ${input.agentKey} run=${runId} for case=${input.caseRow.id}`,
      );
      return { runId };
    }
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(message),
        }),
      );
      this.logger.log(
        `dispatched ${input.agentKey} run=${runId} for case=${input.caseRow.id}`,
      );
    } catch (err) {
      this.logger.error(
        `SQS publish failed for run=${runId}: ${(err as Error).message}`,
      );
      // Mark the run row as failed so the UI shows it.
      try {
        const { eq } = await import('drizzle-orm');
        await this.db
          .update(agentRuns)
          .set({
            status: 'failed',
            completedAt: new Date(),
            errorMessage: `SQS publish failed: ${(err as Error).message}`,
          })
          .where(eq(agentRuns.id, runId));
      } catch {
        // noop — best-effort
      }
    }
    return { runId };
  }
}
