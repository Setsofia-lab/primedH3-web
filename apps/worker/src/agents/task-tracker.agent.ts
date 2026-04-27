/**
 * TaskTrackerAgent (Constitution §4 Agent 9).
 *
 * Trigger: manual from /app/admin/cases/[id], plus future task-mutation
 *          hooks. Output: a re-organized view of the case's tasks
 *          (overdue / due_soon / blocked / future), suggested handoffs
 *          ("EKG due tomorrow but assigned to coordinator — should
 *          reassign to allied?"), and an Asana-mirror payload.
 *
 * Operational, not clinical — output ends as `n_a` HITL by default
 * because the agent never proposes a clinical decision. Suggestions
 * are non-binding; the coordinator chooses whether to act on them.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { DB_CLIENT, type WorkerDb } from '../db/db.module';
import { tasks } from '../db/schema-ref';
import {
  type Agent,
  type AgentInput,
  type AgentPromptOverrides,
  type AgentRunResult,
  type CaseContext,
  type ModelId,
} from './agent.interface';
import { BedrockService } from '../bedrock/bedrock.service';
import { parseModelJson } from './parse-model-json';

const BUCKETS = ['overdue', 'due_soon', 'blocked', 'in_progress', 'future', 'done'] as const;

const handoffSchema = z.object({
  taskId: z.string().uuid(),
  fromRole: z.string().max(40),
  toRole: z.string().max(40),
  reason: z.string().min(1).max(400),
});

const summarySchema = z.object({
  buckets: z.record(z.enum(BUCKETS), z.array(z.string().uuid())),
  suggestedHandoffs: z.array(handoffSchema).max(20).optional(),
  asanaMirror: z
    .object({
      projectName: z.string().max(120),
      taskCount: z.number().int().min(0),
      note: z.string().max(2000),
    })
    .optional(),
  summary: z.string().min(1).max(2000),
});
export type TaskSummary = z.infer<typeof summarySchema>;

interface TaskRow {
  id: string;
  title: string;
  status: string;
  assigneeRole: string;
  assigneeUserId: string | null;
  dueDate: Date | null;
}

interface BucketSnapshot {
  readonly buckets: Record<(typeof BUCKETS)[number], TaskRow[]>;
  readonly counts: Record<(typeof BUCKETS)[number], number>;
}

const SYSTEM_PROMPT = `You are PrimedHealth's TaskTrackerAgent. The platform already
classifies tasks into buckets (overdue / due_soon / blocked /
in_progress / future / done) deterministically. Your job is to
propose handoff suggestions and an Asana-style mirror payload.

Inputs (user message JSON):
  - caseId, surgeryDate, daysToSurgery
  - bucketCounts: { overdue, due_soon, blocked, in_progress, future, done }
  - openTasks: array of { id, title, assigneeRole, dueDate, status }

Output a JSON object (and ONLY JSON):
{
  "buckets": {
    "overdue": [taskId, ...], "due_soon": [...], "blocked": [...],
    "in_progress": [...], "future": [...], "done": [...]
  },
  "suggestedHandoffs": [
    { "taskId": "uuid", "fromRole": "...", "toRole": "...", "reason": "..." }
  ],
  "asanaMirror": {
    "projectName": "case-<short id>",
    "taskCount": <number>,
    "note": "1-2 sentences for the coordinator"
  },
  "summary": "..."
}

Rules:
  - Echo the buckets you receive (the platform owns the classification).
  - Propose handoffs only when an open task has an obvious skill
    mismatch (e.g. EKG with coordinator, surgeon H&P sign with
    anesthesia). Otherwise return an empty array.
  - Never name medications.
  - Never assert a task is "done" or "completed" — that's a coordinator
    action.
  - Keep \`summary\` ≤ 240 chars and operational ("3 overdue items, all
    coordinator-owned"), not clinical.`;

@Injectable()
export class TaskTrackerAgent implements Agent {
  private readonly logger = new Logger(TaskTrackerAgent.name);

  readonly id = 'task_tracker' as const;
  readonly name = 'TaskTrackerAgent';
  readonly defaultModel: ModelId = 'anthropic.claude-haiku-4-5';
  readonly defaultTemperature = 0.0;

  constructor(
    private readonly bedrock: BedrockService,
    @Inject(DB_CLIENT) private readonly db: WorkerDb,
  ) {}

  async run(
    _input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult> {
    const snapshot = await this.snapshot(ctx.caseId);
    const totalOpen = BUCKETS.filter((b) => b !== 'done').reduce(
      (acc, b) => acc + snapshot.counts[b],
      0,
    );
    const userMessage = JSON.stringify({
      caseId: ctx.caseId,
      bucketCounts: snapshot.counts,
      openTasks: BUCKETS.filter((b) => b !== 'done')
        .flatMap((b) => snapshot.buckets[b])
        .slice(0, 50)
        .map((t) => ({
          id: t.id,
          title: t.title,
          assigneeRole: t.assigneeRole,
          dueDate: t.dueDate?.toISOString() ?? null,
          status: t.status,
        })),
    });

    let result: TaskSummary = {
      buckets: Object.fromEntries(
        BUCKETS.map((b) => [b, snapshot.buckets[b].map((t) => t.id)]),
      ) as Record<(typeof BUCKETS)[number], string[]>,
      suggestedHandoffs: [],
      asanaMirror: {
        projectName: `case-${ctx.caseId.slice(0, 8)}`,
        taskCount: totalOpen,
        note:
          'Asana mirroring is stubbed — Asana token not yet provisioned. ' +
          'Counts will reflect the live case once the integration is wired.',
      },
      summary: `${snapshot.counts.overdue} overdue, ${snapshot.counts.due_soon} due soon, ${snapshot.counts.in_progress} in progress.`,
    };

    let usedStub = false;
    let promptTokens = 0;
    let completionTokens = 0;
    let costUsdMicros = 0;

    const systemPrompt = overrides?.systemPrompt ?? SYSTEM_PROMPT;
    const model = overrides?.model ?? this.defaultModel;
    const temperature = overrides?.temperature ?? this.defaultTemperature;

    try {
      const res = await this.bedrock.messages({
        model,
        system: systemPrompt,
        temperature,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 1500,
      });
      promptTokens = res.promptTokens;
      completionTokens = res.completionTokens;
      costUsdMicros = res.costUsdMicros;
      usedStub = res.stub;

      if (!res.stub) {
        const parsed = parseModelJson(res.text);
        const validated = summarySchema.safeParse(parsed);
        if (validated.success) {
          result = validated.data;
        } else {
          this.logger.warn(
            `TaskTracker JSON failed schema, falling back to deterministic snapshot: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `TaskTracker Bedrock call failed; using deterministic snapshot: ${(err as Error).message}`,
      );
    }

    return {
      output: { ...result, totals: snapshot.counts, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'n_a',
      summary: `${totalOpen} open tasks (${snapshot.counts.overdue} overdue).`,
    };
  }

  /**
   * Bucket the case's tasks deterministically. Boundaries are simple
   * and explicit so the coordinator can predict them:
   *   - done: status=done
   *   - blocked: status=blocked
   *   - overdue: dueDate < now AND status != done
   *   - due_soon: dueDate within next 72h AND status != done
   *   - in_progress: status=in_progress
   *   - future: everything else (no due date or > 72h out)
   */
  private async snapshot(caseId: string): Promise<BucketSnapshot> {
    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        assigneeRole: tasks.assigneeRole,
        assigneeUserId: tasks.assigneeUserId,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(and(eq(tasks.caseId, caseId), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.dueDate), asc(tasks.createdAt));

    const now = Date.now();
    const dueSoonHorizon = now + 72 * 3600 * 1000;
    const buckets: BucketSnapshot['buckets'] = {
      overdue: [],
      due_soon: [],
      blocked: [],
      in_progress: [],
      future: [],
      done: [],
    };

    for (const t of rows) {
      const due = t.dueDate?.getTime();
      if (t.status === 'done') buckets.done.push(t);
      else if (t.status === 'blocked') buckets.blocked.push(t);
      else if (due != null && due < now) buckets.overdue.push(t);
      else if (due != null && due < dueSoonHorizon) buckets.due_soon.push(t);
      else if (t.status === 'in_progress') buckets.in_progress.push(t);
      else buckets.future.push(t);
    }

    const counts = Object.fromEntries(
      BUCKETS.map((b) => [b, buckets[b].length]),
    ) as BucketSnapshot['counts'];

    return { buckets, counts };
  }
}
