/**
 * IntakeOrchestrator (Constitution §4 Agent 1).
 *
 * Trigger: case.created
 * Output: an array of suggested workup tasks { title, description?,
 *         assigneeRole, dueInDays? } that the worker turns into rows
 *         on the `tasks` table.
 *
 * Strategy: deterministic baseline (mirrors the M9 stand-in's six
 * tasks) augmented by a Bedrock call that adapts the list to the
 * procedure code + description. The model returns JSON matching the
 * task-template schema; we validate with zod before persisting.
 *
 * If Bedrock isn't reachable (no model access yet, dev offline),
 * BedrockService returns a stub and we fall back to the deterministic
 * baseline so the agent loop is testable end-to-end.
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

const ASSIGNEE_ROLES = [
  'admin',
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied',
  'patient',
] as const;

const taskTemplateSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(4000).optional(),
  assigneeRole: z.enum(ASSIGNEE_ROLES),
  dueInDays: z.number().int().min(0).max(180).optional(),
});

const planSchema = z.object({
  tasks: z.array(taskTemplateSchema).min(1).max(20),
  rationale: z.string().max(2000).optional(),
});
export type IntakePlan = z.infer<typeof planSchema>;

const BASELINE: IntakePlan = {
  tasks: [
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
  ],
};

const SYSTEM_PROMPT = `You are PrimedHealth's IntakeOrchestrator agent. Your job is to
generate a perioperative workup checklist for a surgical case.

Inputs you'll receive (in the user message as JSON):
  - procedureCode: CPT or null
  - procedureDescription: string or null
  - patient: { dob, sex, mrn? }
  - facility: { name, timezone }

Output a JSON object (and ONLY JSON) of the form:
{
  "tasks": [
    {
      "title": "...",                          // <= 256 chars
      "description": "...",                    // optional, <= 4000
      "assigneeRole": "coordinator" | "surgeon" | "anesthesia" |
                       "allied" | "patient" | "admin",
      "dueInDays": <integer 0..180>            // optional
    },
    ...
  ],
  "rationale": "1-3 sentences on why this list fits this case"
}

Rules:
  - Always include: pre-op labs, EKG, anesthesia clearance, surgeon
    H&P sign-off, patient education, informed consent.
  - Add procedure-specific items where appropriate (e.g. cardiology
    consult for ASA >=3 / cardiac procedures, OSA screening for
    bariatric, MRSA screen for orthopedic implants).
  - Never include items that require write-back to Athena (we're
    read-only against Athena per ADR 0002).
  - Never recommend administering medications or scheduling surgery —
    those need a human in the loop.
  - Keep the list under 12 items.
  - Use sensible due-day offsets relative to surgery, not creation.`;

@Injectable()
export class IntakeOrchestratorAgent implements Agent {
  private readonly logger = new Logger(IntakeOrchestratorAgent.name);

  readonly id = 'intake_orchestrator' as const;
  readonly name = 'IntakeOrchestrator';
  readonly defaultModel: ModelId = 'anthropic.claude-sonnet-4-7';
  readonly defaultTemperature = 0.2;

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
      patientId: ctx.patientId,
    });
    const startedAt = Date.now();

    let plan: IntakePlan = BASELINE;
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
        const validated = planSchema.safeParse(parsed);
        if (validated.success) {
          plan = validated.data;
        } else {
          this.logger.warn(
            `IntakeOrchestrator JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `IntakeOrchestrator Bedrock call failed; falling back to baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: {
        tasks: plan.tasks,
        rationale: plan.rationale,
        usedStub,
      },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'n_a',
      summary: usedStub
        ? `Seeded baseline ${plan.tasks.length}-task checklist (Bedrock stub).`
        : `Generated ${plan.tasks.length}-task workup plan via Bedrock.`,
    };
  }
}

