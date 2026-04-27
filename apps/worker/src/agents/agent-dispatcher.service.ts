/**
 * AgentDispatcherService — owns the agent_runs lifecycle.
 *
 * Flow per SQS message:
 *   1. Decode + validate the message body (zod).
 *   2. Mark the pre-created agent_runs row as `running`.
 *   3. Resolve the agent class by `agentId` and call .run().
 *   4. Apply hard-stop policies (deny-list).
 *   5. Persist outputs + token/cost stats.
 *   6. Side-effects (e.g. inserting tasks for IntakeOrchestrator).
 *
 * Per-agent persistence side-effects live alongside the agent so we
 * don't end up with one giant switch in the dispatcher; agents return
 * a structured `output` and the dispatcher dispatches to a side-effect
 * function.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DB_CLIENT, type WorkerDb } from '../db/db.module';
import { applyHardStops } from '../policies/hard-stops';
import { agentRuns, cases, tasks } from '../db/schema-ref';
import { agentMessageSchema, type AgentMessage } from './agent-message.schema';
import { type Agent, type AgentRunResult } from './agent.interface';
import { AnesthesiaClearanceAgent } from './anesthesia-clearance.agent';
import { IntakeOrchestratorAgent } from './intake-orchestrator.agent';
import { PromptRegistryService } from './prompt-registry.service';
import { ReadinessAgent } from './readiness.agent';
import { ReferralAgent } from './referral.agent';
import { RiskScreeningAgent } from './risk-screening.agent';
import { SchedulingAgent } from './scheduling.agent';

@Injectable()
export class AgentDispatcherService {
  private readonly logger = new Logger(AgentDispatcherService.name);
  private readonly registry: Record<string, Agent>;

  constructor(
    @Inject(DB_CLIENT) private readonly db: WorkerDb,
    private readonly intake: IntakeOrchestratorAgent,
    private readonly risk: RiskScreeningAgent,
    private readonly anesthesia: AnesthesiaClearanceAgent,
    private readonly scheduling: SchedulingAgent,
    private readonly referral: ReferralAgent,
    private readonly readiness: ReadinessAgent,
    private readonly prompts: PromptRegistryService,
  ) {
    this.registry = {
      [intake.id]: intake,
      [risk.id]: risk,
      [anesthesia.id]: anesthesia,
      [scheduling.id]: scheduling,
      [referral.id]: referral,
      [readiness.id]: readiness,
    };
  }

  /**
   * Dispatch one SQS message. Throws on transient failures so SQS will
   * retry (and eventually DLQ). Validation / hard-stop / unknown-agent
   * errors are persisted as failed runs and NOT thrown — those are
   * permanent and shouldn't get redelivered.
   */
  async handle(rawBody: string): Promise<void> {
    const parsed = parseMessage(rawBody);
    if (!parsed) {
      this.logger.error(`agent message failed schema; dropping: ${rawBody.slice(0, 200)}`);
      return;
    }

    const agent = this.registry[parsed.agentId];
    if (!agent) {
      await this.failRun(
        parsed,
        `no agent registered for id=${parsed.agentId}`,
      );
      return;
    }

    const activePrompt = await this.prompts.getActive(parsed.agentId).catch((err) => {
      this.logger.error(
        `prompt registry lookup failed for ${parsed.agentId}: ${(err as Error).message}`,
      );
      return null;
    });

    await this.markRunning(parsed, activePrompt?.id ?? null);

    const startedAt = Date.now();
    let result: AgentRunResult;
    try {
      result = await agent.run(
        { triggerEvent: parsed.triggerEvent, payload: parsed.payload },
        {
          caseId: parsed.context.caseId,
          facilityId: parsed.context.facilityId,
          patientId: parsed.context.patientId,
          procedureCode: parsed.context.procedureCode ?? undefined,
          procedureDescription: parsed.context.procedureDescription ?? undefined,
          surgeonId: parsed.context.surgeonId ?? null,
        },
        activePrompt
          ? {
              systemPrompt: activePrompt.systemPrompt,
              model: activePrompt.model,
              temperature: activePrompt.temperature,
            }
          : undefined,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `agent ${parsed.agentId} threw on run ${parsed.runId}: ${message}`,
      );
      await this.failRun(parsed, message);
      // Re-throw transient errors so SQS retries.
      throw err;
    }

    const latencyMs = Date.now() - startedAt;

    // Hard-stops can override the agent's self-reported hitl status.
    // If a deny-list rule trips, we force `pending` and skip side-effects
    // until a human approves from the admin runs panel.
    const stops = applyHardStops(parsed.agentId, result.output);
    const hitlStatus = stops.hitlRequired
      ? ('pending' as const)
      : (result.hitlStatus ?? 'n_a');
    const stopsNote = stops.hitlRequired ? stops.reasons.join('\n') : null;

    // Persist the run row.
    await this.db
      .update(agentRuns)
      .set({
        status: 'succeeded',
        outputJson: result.output as object,
        toolCallsJson: result.toolCalls
          ? (result.toolCalls as unknown as object)
          : null,
        promptTokens: result.promptTokens ?? 0,
        completionTokens: result.completionTokens ?? 0,
        totalCostUsdMicros: result.costUsdMicros ?? 0,
        latencyMs,
        completedAt: new Date(),
        hitlStatus,
        errorMessage: stopsNote,
      })
      .where(eq(agentRuns.id, parsed.runId));

    // Side-effects only fire when nothing is gating on a human.
    if (hitlStatus === 'pending') {
      this.logger.warn(
        `${parsed.agentId} run=${parsed.runId} blocked by hard-stops; skipping side-effects: ${stopsNote}`,
      );
    } else if (parsed.agentId === 'intake_orchestrator') {
      await this.applyIntakeOutput(parsed, result.output);
    } else if (parsed.agentId === 'readiness') {
      await this.applyReadinessOutput(parsed, result.output);
    }

    this.logger.log(
      `${parsed.agentId} run=${parsed.runId} done in ${latencyMs}ms — ${result.summary}`,
    );
  }

  private async markRunning(msg: AgentMessage, promptVersionId: string | null): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: 'running',
        startedAt: new Date(),
        promptVersionId,
      })
      .where(eq(agentRuns.id, msg.runId));
  }

  private async failRun(msg: AgentMessage, message: string): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: message,
      })
      .where(eq(agentRuns.id, msg.runId));
  }

  /**
   * IntakeOrchestrator side-effect: insert the proposed task rows on
   * the case. We don't gate this through the api — agents and api
   * share the database; the api will see the new rows on next read.
   */
  private async applyIntakeOutput(
    msg: AgentMessage,
    output: Record<string, unknown>,
  ): Promise<void> {
    const list = Array.isArray((output as { tasks?: unknown }).tasks)
      ? ((output as { tasks: Array<{
          title: string;
          description?: string;
          assigneeRole:
            | 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';
          dueInDays?: number;
        }> }).tasks)
      : [];
    if (list.length === 0) return;

    const now = Date.now();
    const rows = list.map((t) => ({
      facilityId: msg.context.facilityId,
      caseId: msg.context.caseId,
      title: t.title,
      description: t.description ?? null,
      status: 'pending' as const,
      assigneeRole: t.assigneeRole,
      assigneeUserId: null,
      dueDate:
        typeof t.dueInDays === 'number'
          ? new Date(now + t.dueInDays * 24 * 3600 * 1000)
          : null,
    }));
    try {
      await this.db.insert(tasks).values(rows);
      this.logger.log(
        `IntakeOrchestrator seeded ${rows.length} tasks for case=${msg.context.caseId}`,
      );
    } catch (err) {
      this.logger.error(
        `failed to insert IntakeOrchestrator tasks for case=${msg.context.caseId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * ReadinessAgent side-effect: write the computed score back onto
   * `cases.readiness_score`. The patient PWA + coordinator board read
   * directly from the column; the agent_runs row keeps the audit trail.
   */
  private async applyReadinessOutput(
    msg: AgentMessage,
    output: Record<string, unknown>,
  ): Promise<void> {
    const score = (output as { score?: unknown }).score;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      this.logger.warn(
        `ReadinessAgent run=${msg.runId} produced no numeric score; skipping writeback`,
      );
      return;
    }
    const clamped = Math.min(100, Math.max(0, Math.round(score)));
    try {
      await this.db
        .update(cases)
        .set({ readinessScore: clamped, updatedAt: new Date() })
        .where(eq(cases.id, msg.context.caseId));
      this.logger.log(
        `ReadinessAgent set readinessScore=${clamped} for case=${msg.context.caseId}`,
      );
    } catch (err) {
      this.logger.error(
        `failed to update readinessScore for case=${msg.context.caseId}: ${(err as Error).message}`,
      );
    }
  }
}

function parseMessage(raw: string): AgentMessage | null {
  try {
    const parsed = agentMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
