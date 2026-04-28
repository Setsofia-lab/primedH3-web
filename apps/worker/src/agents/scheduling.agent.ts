/**
 * SchedulingAgent (Constitution §4 Agent 5).
 *
 * Trigger: manual from /app/admin/cases/[id] until calendar MCP lands
 *          (M15). Output: proposed slot windows for surgeon + OR + the
 *          patient. Never books — that's a hard-stop
 *          (NEVER_BOOK_WITHOUT_PROVIDER_APPROVAL).
 */
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

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

const slotSchema = z.object({
  startIso: z.iso.datetime(),
  endIso: z.iso.datetime(),
  surgeonId: z.string().uuid().nullable().optional(),
  facilityRoom: z.string().max(120).optional(),
  rationale: z.string().max(2000).optional(),
});
const proposalSchema = z.object({
  proposedSlots: z.array(slotSchema).min(1).max(8),
  patientPreferenceQuestions: z.array(z.string().max(400)).max(8).optional(),
  blockers: z.array(z.string().max(400)).max(10).optional(),
  summary: z.string().max(2000),
});
export type SchedulingProposal = z.infer<typeof proposalSchema>;

const BASELINE: SchedulingProposal = {
  proposedSlots: [],
  patientPreferenceQuestions: [
    'Are weekday mornings preferred?',
    'Any travel restrictions in the next 4 weeks?',
  ],
  blockers: ['Calendar MCP not connected — slot generation skipped (baseline output).'],
  summary:
    'Calendar integration not yet enabled in this environment. Coordinator should propose slots manually until M15.',
};

const SYSTEM_PROMPT = `You are PrimedHealth's SchedulingAgent. You PROPOSE slot windows
that a coordinator/surgeon then approves. You never book.

Inputs (user message JSON):
  - procedureCode, procedureDescription
  - patientPreferences: free text or null
  - earliestStart, latestStart (ISO timestamps), default 14d-60d out
  - surgeonAvailability: array of free-window ranges (or empty)
  - facilityHours: { open, close, timezone }

Output a JSON object (and ONLY JSON):
{
  "proposedSlots": [
    {
      "startIso": "...",
      "endIso": "...",
      "surgeonId": "uuid"|null,
      "facilityRoom": "OR-3"|undefined,
      "rationale": "early in the week, anesthesia available"
    }
  ],
  "patientPreferenceQuestions": [ "..." ],
  "blockers": [ "..." ],
  "summary": "..."
}

Rules:
  - Never set "booked" / "confirmed" — these trip a hard-stop.
  - Propose 3-5 slots when possible; never more than 8.
  - Stay within facility hours; do not propose nights/weekends unless
    facilityHours says so.`;

@Injectable()
export class SchedulingAgent implements Agent {
  private readonly logger = new Logger(SchedulingAgent.name);

  readonly id = 'scheduling' as const;
  readonly name = 'SchedulingAgent';
  readonly defaultModel: ModelId = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
  readonly defaultTemperature = 0.0;

  constructor(private readonly bedrock: BedrockService) {}

  async run(
    input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult> {
    const userMessage = JSON.stringify({
      procedureCode: ctx.procedureCode ?? null,
      procedureDescription: ctx.procedureDescription ?? null,
      caseId: ctx.caseId,
      payload: input.payload,
    });

    let proposal: SchedulingProposal = BASELINE;
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
        const validated = proposalSchema.safeParse(parsed);
        if (validated.success) {
          proposal = validated.data;
        } else {
          this.logger.warn(
            `Scheduling JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Scheduling Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: { ...proposal, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'pending',
      summary: usedStub
        ? `Baseline scheduling response (no slots; calendar MCP not wired).`
        : `Proposed ${proposal.proposedSlots.length} slot(s).`,
    };
  }
}
