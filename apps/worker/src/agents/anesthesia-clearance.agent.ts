/**
 * AnesthesiaClearanceAgent (Constitution §4 Agent 3).
 *
 * Trigger: case.created
 * Output: a peri-anesthesia draft note with ASA, RCRI, and STOP-BANG
 *         scores, plus reviewer focus areas. Never asserts a clearance
 *         verdict — that's a hard-stop (NEVER_AUTO_CLEAR_PATIENT) and
 *         a provider must sign off.
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

const ASA_LEVELS = ['I', 'II', 'III', 'IV', 'V'] as const;
const SEVERITY = ['low', 'moderate', 'high'] as const;

const noteSchema = z.object({
  asa: z.enum(ASA_LEVELS),
  asaRationale: z.string().min(1).max(2000),
  rcri: z.object({
    score: z.number().int().min(0).max(6),
    components: z.array(z.string().max(120)),
  }),
  stopBang: z.object({
    score: z.number().int().min(0).max(8),
    components: z.array(z.string().max(120)),
  }),
  airwayConcerns: z.array(z.string().max(2000)).max(10).optional(),
  cardiopulmonaryConcerns: z.array(z.string().max(2000)).max(10).optional(),
  draftNote: z.string().min(1).max(8000),
  reviewerFocus: z.string().max(2000),
  overallSeverity: z.enum(SEVERITY),
});
export type AnesthesiaNote = z.infer<typeof noteSchema>;

const BASELINE: AnesthesiaNote = {
  asa: 'II',
  asaRationale:
    'Default ASA II pending full chart review. Adjust upward if comorbidities (CHF, COPD, DM with end-organ damage) are uncovered.',
  rcri: { score: 0, components: [] },
  stopBang: { score: 0, components: [] },
  airwayConcerns: [],
  cardiopulmonaryConcerns: [],
  draftNote:
    'Patient referred for elective surgery. Pre-anesthesia evaluation pending. Recommend completing STOP-BANG questionnaire, reviewing cardiac history with EKG, and confirming airway exam at the pre-anesthesia visit.',
  reviewerFocus:
    'Confirm ASA classification after history, OSA risk via STOP-BANG, and airway Mallampati. Verify no missing labs.',
  overallSeverity: 'low',
};

const SYSTEM_PROMPT = `You are PrimedHealth's AnesthesiaClearanceAgent. You produce a draft
pre-anesthesia note — never a clearance verdict. A human anesthesia
provider must review and sign off.

Inputs (user message JSON):
  - procedureCode: CPT or null
  - procedureDescription: string or null
  - patient: { dob, sex, mrn? }

Output a JSON object (and ONLY JSON):
{
  "asa": "I"|"II"|"III"|"IV"|"V",
  "asaRationale": "...",
  "rcri": { "score": <0..6>, "components": ["history of MI", ...] },
  "stopBang": { "score": <0..8>, "components": ["BMI > 35", ...] },
  "airwayConcerns": [ "..." ],
  "cardiopulmonaryConcerns": [ "..." ],
  "draftNote": "...",                        // markdown OK
  "reviewerFocus": "...",
  "overallSeverity": "low"|"moderate"|"high"
}

Rules:
  - Never use "cleared", "approved for surgery", or any synonym.
    Use "low risk" / "needs further workup" instead.
  - Never name medications.
  - Be honest about missing data — say "needs in-person assessment"
    rather than guessing.
  - Keep \`draftNote\` ≤ 1500 words.`;

@Injectable()
export class AnesthesiaClearanceAgent implements Agent {
  private readonly logger = new Logger(AnesthesiaClearanceAgent.name);

  readonly id = 'anesthesia_clearance' as const;
  readonly name = 'AnesthesiaClearanceAgent';
  readonly defaultModel: ModelId = 'anthropic.claude-opus-4-7';
  readonly defaultTemperature = 0.1;

  constructor(private readonly bedrock: BedrockService) {}

  async run(
    _input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult> {
    const userMessage = JSON.stringify({
      procedureCode: ctx.procedureCode ?? null,
      procedureDescription: ctx.procedureDescription ?? null,
      caseId: ctx.caseId,
      patientId: ctx.patientId,
    });

    let note: AnesthesiaNote = BASELINE;
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
        maxTokens: 3000,
      });
      promptTokens = res.promptTokens;
      completionTokens = res.completionTokens;
      costUsdMicros = res.costUsdMicros;
      usedStub = res.stub;

      if (!res.stub) {
        const parsed = parseModelJson(res.text);
        const validated = noteSchema.safeParse(parsed);
        if (validated.success) {
          note = validated.data;
        } else {
          this.logger.warn(
            `Anesthesia JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Anesthesia Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: { ...note, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'pending',
      summary: usedStub
        ? `Baseline anesthesia note (Bedrock stub, ASA ${note.asa}).`
        : `Drafted anesthesia note — ASA ${note.asa}, RCRI ${note.rcri.score}, STOP-BANG ${note.stopBang.score}.`,
    };
  }
}
