/**
 * PreHabAgent (Constitution §4 Agent 7).
 *
 * Trigger: case.created (joins the on-create fan-out) and re-runs on
 *          demand from the case detail page.
 *
 * Output: a pre-habilitation regimen — exercise items, nutritional
 *         guidance, smoking / alcohol cessation prompts, adherence
 *         check-ins. NEVER prescribes medications (universal hard-stop)
 *         and recommendations always pause for HITL because they're
 *         clinical guidance.
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

const REGIMEN_CATEGORIES = [
  'exercise',
  'nutrition',
  'smoking_cessation',
  'alcohol_reduction',
  'breathing',
  'sleep',
  'mental_health',
  'mobility',
] as const;

const itemSchema = z.object({
  category: z.enum(REGIMEN_CATEGORIES),
  title: z.string().min(1).max(200),
  instruction: z.string().min(1).max(2000),
  frequency: z.string().min(1).max(120),
  durationWeeks: z.number().int().min(1).max(52).optional(),
  evidenceNote: z.string().max(2000).optional(),
});
const checkInSchema = z.object({
  daysAfterStart: z.number().int().min(1).max(180),
  question: z.string().min(1).max(400),
});
const regimenSchema = z.object({
  items: z.array(itemSchema).min(1).max(15),
  checkIns: z.array(checkInSchema).max(8).optional(),
  patientSummary: z.string().min(1).max(4000),
  reviewerFocus: z.string().max(2000).optional(),
});
export type PreHabRegimen = z.infer<typeof regimenSchema>;

const BASELINE: PreHabRegimen = {
  items: [
    {
      category: 'exercise',
      title: 'Daily walk',
      instruction:
        'Walk at a comfortable pace for 20-30 minutes per day. Use a tracker or app to log each session.',
      frequency: 'daily',
      durationWeeks: 4,
      evidenceNote:
        'Light aerobic activity in the weeks before surgery is associated with shorter recovery and fewer pulmonary complications.',
    },
    {
      category: 'breathing',
      title: 'Incentive spirometry practice',
      instruction:
        'Take 10 slow deep breaths with an incentive spirometer 3 times per day, building lung capacity.',
      frequency: '3x daily',
      durationWeeks: 4,
    },
    {
      category: 'nutrition',
      title: 'Protein-forward meals',
      instruction:
        'Aim for 1.2g protein per kg of body weight daily. Lean meats, fish, eggs, legumes, dairy.',
      frequency: 'each meal',
      durationWeeks: 4,
    },
    {
      category: 'sleep',
      title: 'Consistent sleep window',
      instruction:
        'Target 7-8 hours per night with a consistent bedtime. Limit screens 60 minutes before bed.',
      frequency: 'nightly',
      durationWeeks: 4,
    },
  ],
  checkIns: [
    { daysAfterStart: 7, question: 'How many days were you able to walk this past week?' },
    { daysAfterStart: 14, question: 'Any new shortness of breath or pain during exercise?' },
    { daysAfterStart: 21, question: 'How is your protein intake going?' },
  ],
  patientSummary:
    'A short pre-surgery prep plan: light daily walking, deep breathing practice, protein-forward meals, and consistent sleep. Your team will check in along the way.',
  reviewerFocus:
    'Confirm the patient has no exercise restrictions; adjust intensity for cardiac/pulmonary comorbidities.',
};

const SYSTEM_PROMPT = `You are PrimedHealth's PreHabAgent. You produce a 2-6 week
pre-habilitation regimen for a peri-operative patient. Your output is
a draft for clinician review — never auto-applied.

Inputs (user message JSON):
  - procedureCode, procedureDescription
  - patient: { dob, sex, mrn? }
  - daysToSurgery: integer or null
  - knownLimitations: free text or null

Output a JSON object (and ONLY JSON):
{
  "items": [
    {
      "category": "exercise"|"nutrition"|"smoking_cessation"|
                  "alcohol_reduction"|"breathing"|"sleep"|
                  "mental_health"|"mobility",
      "title": "...",
      "instruction": "...",          // patient-readable
      "frequency": "daily"|"3x daily"|"twice weekly"|...,
      "durationWeeks": <1..52>,
      "evidenceNote": "..."          // optional, for the reviewer
    }
  ],
  "checkIns": [
    { "daysAfterStart": <1..180>, "question": "..." }
  ],
  "patientSummary": "...",           // ≤ 240 words, plain language
  "reviewerFocus": "..."
}

Rules:
  - Cover at least: exercise, breathing, nutrition.
  - Never prescribe a medication or dose. Use "consult your prescribing
    clinician about your current medications" instead.
  - Adapt to daysToSurgery: if < 14 days, propose minimal items.
  - Items must be SAFE for someone with unknown comorbidities — assume
    cardiopulmonary fragility unless told otherwise.
  - Keep the list under 12 items.`;

@Injectable()
export class PreHabAgent implements Agent {
  private readonly logger = new Logger(PreHabAgent.name);

  readonly id = 'pre_hab' as const;
  readonly name = 'PreHabAgent';
  readonly defaultModel: ModelId = 'anthropic.claude-haiku-4-5';
  readonly defaultTemperature = 0.2;

  constructor(private readonly bedrock: BedrockService) {}

  async run(
    input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult> {
    const userMessage = JSON.stringify({
      caseId: ctx.caseId,
      procedureCode: ctx.procedureCode ?? null,
      procedureDescription: ctx.procedureDescription ?? null,
      payload: input.payload,
    });

    let regimen: PreHabRegimen = BASELINE;
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
        maxTokens: 2500,
      });
      promptTokens = res.promptTokens;
      completionTokens = res.completionTokens;
      costUsdMicros = res.costUsdMicros;
      usedStub = res.stub;

      if (!res.stub) {
        const parsed = parseModelJson(res.text);
        const validated = regimenSchema.safeParse(parsed);
        if (validated.success) {
          regimen = validated.data;
        } else {
          this.logger.warn(
            `PreHab JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `PreHab Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: { ...regimen, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'pending',
      summary: usedStub
        ? `Baseline ${regimen.items.length}-item pre-hab regimen (Bedrock stub).`
        : `Drafted ${regimen.items.length}-item pre-hab regimen.`,
    };
  }
}
