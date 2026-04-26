/**
 * ReadinessAgent (Constitution §4 Agent 10).
 *
 * Trigger: case.created, task.completed (any task status flip), and
 *          on demand from the admin panel.
 * Output: { score: 0..100, breakdown, blockers, narrative } and a
 *         side-effect of updating cases.readiness_score so the patient
 *         PWA + coordinator board read a single source.
 *
 * Strategy:
 *   - Score is *deterministic* — counts complete vs. open tasks and
 *     pulls the latest risk_screening / anesthesia_clearance run state
 *     from agent_runs. Never asks an LLM for the number; clinicians
 *     would not trust a non-reproducible score.
 *   - The narrative ("Patient is on track for surgery on …") is
 *     optional Bedrock — falls back to a templated string when
 *     stubbed or model access is off.
 *   - hitlStatus = 'n_a' (aggregation, not a clinical recommendation).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { DB_CLIENT, type WorkerDb } from '../db/db.module';
import { agentRuns, tasks } from '../db/schema-ref';
import { BedrockService } from '../bedrock/bedrock.service';
import {
  type Agent,
  type AgentInput,
  type AgentPromptOverrides,
  type AgentRunResult,
  type CaseContext,
  type ModelId,
} from './agent.interface';

const SYSTEM_PROMPT = `You are PrimedHealth's ReadinessAgent narrator. You receive a fully
computed readiness score plus the supporting counts and write a short,
patient-facing summary.

Input is a JSON object:
{
  "score": <0..100>,
  "tasks": { "done": n, "total": n },
  "risk": "approved"|"pending"|"declined"|"none",
  "anesthesia": "approved"|"pending"|"declined"|"none",
  "blockers": [ "…", "…" ]
}

Output a JSON object (and ONLY JSON):
{
  "narrative": "1-2 sentences for the patient PWA, plain language,
                ≤ 240 chars, no medical jargon",
  "internalNote": "1-2 sentences for the coordinator dashboard"
}

Rules:
  - Never claim the patient is "cleared" / "approved for surgery";
    those are provider verdicts. Use "on track" / "almost ready" /
    "still has X pending" instead.
  - Never name medications.
  - Never reference internal staff names.`;

const TEMPLATE_NARRATIVE = (score: number, blockers: readonly string[]): string => {
  if (score >= 90) return 'You are on track for your upcoming surgery — no outstanding items.';
  if (score >= 60) {
    return blockers[0]
      ? `Almost ready. Next up: ${blockers[0]}.`
      : 'Almost ready — your care team is finalizing the workup.';
  }
  if (score >= 30) {
    return blockers.length > 0
      ? `A few items remain before surgery: ${blockers.slice(0, 2).join('; ')}.`
      : 'Your care team is gathering the pieces of your pre-op workup.';
  }
  return 'Your pre-op workup is just getting started — your care team will guide you through each step.';
};

export type ReviewState = 'approved' | 'pending' | 'declined' | 'none';

export interface ReadinessInputs {
  readonly tasks: { done: number; total: number; openTitles: readonly string[] };
  readonly risk: ReviewState;
  readonly anesthesia: ReviewState;
}

export interface ReadinessSnapshot {
  readonly score: number;
  readonly tasks: { done: number; total: number };
  readonly risk: ReviewState;
  readonly anesthesia: ReviewState;
  readonly blockers: readonly string[];
}

const reviewWeight = (s: ReviewState): number => {
  if (s === 'approved') return 20;
  if (s === 'pending') return 10;
  return 0;
};

/**
 * Pure scoring math — no DB. Exported for unit tests; the agent's
 * runtime path queries the data and feeds it in via {@link computeSnapshot}.
 *
 * Weights (sum to 100):
 *   - 60: task completion ratio (done / total)
 *   - 20: risk screen — approved=full, pending=half, declined/none=0
 *   - 20: anesthesia clearance — same buckets
 */
export function scoreReadiness(input: ReadinessInputs): ReadinessSnapshot {
  const { done, total, openTitles } = input.tasks;
  const taskScore = total === 0 ? 0 : (done / total) * 60;
  const score = Math.round(taskScore + reviewWeight(input.risk) + reviewWeight(input.anesthesia));

  const blockers: string[] = [];
  if (input.risk === 'pending') blockers.push('Risk screen awaiting provider review');
  if (input.risk === 'declined') blockers.push('Risk screen declined — see notes');
  if (input.anesthesia === 'pending') blockers.push('Anesthesia clearance pending');
  if (input.anesthesia === 'declined') blockers.push('Anesthesia clearance declined');
  for (const title of openTitles.slice(0, 3)) blockers.push(title);

  return {
    score: Math.min(100, Math.max(0, score)),
    tasks: { done, total },
    risk: input.risk,
    anesthesia: input.anesthesia,
    blockers,
  };
}

@Injectable()
export class ReadinessAgent implements Agent {
  private readonly logger = new Logger(ReadinessAgent.name);

  readonly id = 'readiness' as const;
  readonly name = 'ReadinessAgent';
  readonly defaultModel: ModelId = 'anthropic.claude-sonnet-4-7';
  readonly defaultTemperature = 0.1;

  constructor(
    private readonly bedrock: BedrockService,
    @Inject(DB_CLIENT) private readonly db: WorkerDb,
  ) {}

  async run(
    _input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult> {
    const snapshot = await this.computeSnapshot(ctx.caseId);
    const systemPrompt = overrides?.systemPrompt ?? SYSTEM_PROMPT;
    const model = overrides?.model ?? this.defaultModel;
    const temperature = overrides?.temperature ?? this.defaultTemperature;

    let narrative = TEMPLATE_NARRATIVE(snapshot.score, snapshot.blockers);
    let internalNote = `Score ${snapshot.score} — tasks ${snapshot.tasks.done}/${snapshot.tasks.total}, risk=${snapshot.risk}, anesthesia=${snapshot.anesthesia}.`;
    let usedStub = false;
    let promptTokens = 0;
    let completionTokens = 0;
    let costUsdMicros = 0;

    try {
      const res = await this.bedrock.messages({
        model,
        system: systemPrompt,
        temperature,
        messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
        maxTokens: 400,
      });
      promptTokens = res.promptTokens;
      completionTokens = res.completionTokens;
      costUsdMicros = res.costUsdMicros;
      usedStub = res.stub;

      if (!res.stub) {
        const parsed = parseModelJson(res.text);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { narrative?: unknown }).narrative === 'string'
        ) {
          const p = parsed as { narrative: string; internalNote?: string };
          narrative = p.narrative.slice(0, 240);
          if (typeof p.internalNote === 'string' && p.internalNote.length > 0) {
            internalNote = p.internalNote;
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `ReadinessAgent narrative call failed; using template: ${(err as Error).message}`,
      );
    }

    return {
      output: {
        score: snapshot.score,
        tasks: snapshot.tasks,
        risk: snapshot.risk,
        anesthesia: snapshot.anesthesia,
        blockers: snapshot.blockers,
        narrative,
        internalNote,
        usedStub,
      },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'n_a',
      summary: `Readiness ${snapshot.score} (tasks ${snapshot.tasks.done}/${snapshot.tasks.total}).`,
    };
  }

  private async computeSnapshot(caseId: string): Promise<ReadinessSnapshot> {
    const taskRows = await this.db
      .select({
        title: tasks.title,
        status: tasks.status,
      })
      .from(tasks)
      .where(and(eq(tasks.caseId, caseId), isNull(tasks.deletedAt)));

    const done = taskRows.filter((t) => t.status === 'done').length;
    const openTitles = taskRows.filter((t) => t.status !== 'done').map((t) => t.title);

    const risk = await this.latestHitlStatus(caseId, 'risk_screening');
    const anesthesia = await this.latestHitlStatus(caseId, 'anesthesia_clearance');

    return scoreReadiness({
      tasks: { done, total: taskRows.length, openTitles },
      risk,
      anesthesia,
    });
  }

  private async latestHitlStatus(
    caseId: string,
    agentKey: 'risk_screening' | 'anesthesia_clearance',
  ): Promise<ReviewState> {
    const [row] = await this.db
      .select({ hitlStatus: agentRuns.hitlStatus, status: agentRuns.status })
      .from(agentRuns)
      .where(and(eq(agentRuns.caseId, caseId), eq(agentRuns.agentKey, agentKey)))
      .orderBy(desc(agentRuns.createdAt))
      .limit(1);
    if (!row) return 'none';
    if (row.status !== 'succeeded') return 'pending';
    if (row.hitlStatus === 'approved') return 'approved';
    if (row.hitlStatus === 'declined') return 'declined';
    return 'pending';
  }
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = /```(?:json)?\s*([\s\S]+?)\s*```/m.exec(trimmed);
  const raw = fence ? fence[1] : trimmed;
  try {
    return JSON.parse(raw ?? '');
  } catch {
    const m = /\{[\s\S]+\}/.exec(raw ?? '');
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
