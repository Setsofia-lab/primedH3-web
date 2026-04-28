/**
 * ReferralAgent (Constitution §4 Agent 4).
 *
 * Trigger: manual from /app/admin/cases/[id]. Output: a draft
 *          specialty-referral letter with the context pack (problem
 *          list, vitals, recent labs). The letter is NEVER sent —
 *          NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF is a hard-stop. A
 *          provider reviews from the runs panel and presses send.
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

const SPECIALTIES = [
  'cardiology',
  'pulmonology',
  'endocrinology',
  'nephrology',
  'hematology',
  'gastroenterology',
  'neurology',
  'sleep_medicine',
  'pain_management',
  'physical_therapy',
  'nutrition',
] as const;

const draftSchema = z.object({
  specialty: z.enum(SPECIALTIES),
  recipient: z.string().max(200).optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(20).max(20_000),
  contextPack: z.array(z.string().max(500)).max(20).optional(),
  followUpQuestions: z.array(z.string().max(400)).max(8).optional(),
  urgency: z.enum(['routine', 'expedited', 'urgent']),
});
export type ReferralDraft = z.infer<typeof draftSchema>;

const BASELINE: ReferralDraft = {
  specialty: 'cardiology',
  recipient: undefined,
  subject: 'Pre-operative cardiology consultation request',
  body:
    'Dear Colleague,\n\n' +
    'I am referring a patient scheduled for an elective surgical procedure for ' +
    'pre-operative cardiology assessment. Please find the available chart context ' +
    'attached. We would appreciate your input on RCRI risk classification, ' +
    'optimization of any active cardiac conditions, and clearance for the planned ' +
    'anesthesia.\n\n' +
    'Thank you for your time.',
  contextPack: ['Bedrock stubbed — full context pack will populate once model access is enabled.'],
  followUpQuestions: [
    'Is the patient a candidate for the planned anesthesia plan?',
    'Any additional pre-op testing recommended?',
  ],
  urgency: 'routine',
};

const SYSTEM_PROMPT = `You are PrimedHealth's ReferralAgent. You DRAFT specialty-referral
letters; the surgeon signs and sends. Never claim the letter has been
sent.

Inputs (user message JSON):
  - procedureCode, procedureDescription
  - patient: { dob, sex, mrn? }
  - referralReason: free text from the requesting clinician
  - targetSpecialty: optional (one of the enum below) or null

Output a JSON object (and ONLY JSON):
{
  "specialty": "cardiology"|"pulmonology"|"endocrinology"|"nephrology"|
               "hematology"|"gastroenterology"|"neurology"|
               "sleep_medicine"|"pain_management"|"physical_therapy"|
               "nutrition",
  "recipient": "Dr. Smith"|undefined,
  "subject": "...",
  "body": "...",                    // formal letter, ≤ 4 paragraphs
  "contextPack": [ "..." ],         // 5-15 chart-context bullets
  "followUpQuestions": [ "..." ],   // ≤ 8
  "urgency": "routine"|"expedited"|"urgent"
}

Rules:
  - Never set sent=true / status=sent / delivered=true. The dispatcher
    blocks side-effects on those substrings.
  - Never name a specific medication or dosage; refer to "current
    medications" generically.
  - Body must be under 600 words.
  - Default urgency = "routine" unless the input explicitly indicates
    a time-sensitive concern.`;

@Injectable()
export class ReferralAgent implements Agent {
  private readonly logger = new Logger(ReferralAgent.name);

  readonly id = 'referral' as const;
  readonly name = 'ReferralAgent';
  readonly defaultModel: ModelId = 'us.anthropic.claude-sonnet-4-6';
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
      payload: input.payload,
    });

    let draft: ReferralDraft = BASELINE;
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
        const validated = draftSchema.safeParse(parsed);
        if (validated.success) {
          draft = validated.data;
        } else {
          this.logger.warn(
            `Referral JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Referral Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: { ...draft, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'pending',
      summary: usedStub
        ? `Baseline ${draft.specialty} referral draft (Bedrock stub).`
        : `Drafted ${draft.specialty} referral (urgency=${draft.urgency}).`,
    };
  }
}
