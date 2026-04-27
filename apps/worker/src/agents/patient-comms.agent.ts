/**
 * PatientCommsAgent (Constitution §4 Agent 6).
 *
 * Trigger: manual from /app/admin/cases/[id], plus inbound patient
 *          messages once the messaging hook lands (M14.x).
 *
 * Output: a draft reply to a patient question PLUS a routing
 *         classification: reply (informational, low risk), escalate
 *         (provider must answer), route_to (specialty / role).
 *
 * Discipline:
 *   - The draft reply NEVER auto-sends — that's a hard-stop
 *     (NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF). A coordinator/provider
 *     reviews from the admin runs panel and presses send.
 *   - Anything clinical → hitlStatus='pending'. Pure FAQ ("where do I
 *     park?", "what time should I arrive?") may end with 'n_a' so
 *     the coordinator only sees ambiguous cases.
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

const ROUTE_TARGETS = [
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied',
  'billing',
  'unknown',
] as const;
const ACTIONS = ['reply', 'escalate', 'route_to'] as const;

const draftSchema = z.object({
  action: z.enum(ACTIONS),
  draftReply: z.string().min(1).max(8000),
  routeTo: z.enum(ROUTE_TARGETS).optional(),
  escalationReason: z.string().max(2000).optional(),
  sensitiveTopics: z.array(z.string().max(120)).max(10).optional(),
  /** Agent-self-reported confidence the reply is appropriate without HITL. */
  confidence: z.enum(['low', 'medium', 'high']),
});
export type PatientCommsDraft = z.infer<typeof draftSchema>;

const BASELINE: PatientCommsDraft = {
  action: 'escalate',
  draftReply:
    'Thanks for reaching out. A member of your care team will follow up with you shortly. ' +
    'For urgent concerns, please call our office or seek care at the nearest emergency department.',
  routeTo: 'coordinator',
  escalationReason: 'Bedrock stubbed — defaulting to escalation rather than auto-replying.',
  sensitiveTopics: [],
  confidence: 'low',
};

const SYSTEM_PROMPT = `You are PrimedHealth's PatientCommsAgent. You help draft replies to
patient messages on a peri-operative coordination platform. You never
send anything yourself — a human on the care team always reviews.

Inputs (user message JSON):
  - message: the patient's most recent message (text)
  - thread: array of prior messages (newest last), or empty
  - context: { procedureDescription, surgeryDate, daysToSurgery,
               careTeam: { surgeon, coordinator } }

Output a JSON object (and ONLY JSON):
{
  "action": "reply" | "escalate" | "route_to",
  "draftReply": "...",                 // markdown OK, ≤ 600 words
  "routeTo": "surgeon"|"anesthesia"|"coordinator"|"allied"|
             "billing"|"unknown"|undefined,
  "escalationReason": "...",
  "sensitiveTopics": [ "post-op pain", "bleeding" ],
  "confidence": "low"|"medium"|"high"
}

Rules:
  - NEVER mark the message as sent / delivered.
  - If the question is clinical (symptoms, medications, dosing, anything
    that could affect peri-op safety) → action = "escalate" and
    confidence ≤ "medium".
  - Pure logistics (parking, paperwork, what to bring, time to arrive,
    pre-op fasting confirmation): action = "reply", confidence = "high".
  - Insurance / billing: action = "route_to" with routeTo = "billing".
  - Never name a specific medication or dosage. Use "your prescribed
    medications" generically.
  - Default to "escalate" when in doubt.
  - Keep \`draftReply\` warm but precise; address the patient by first
    name only if known.`;

@Injectable()
export class PatientCommsAgent implements Agent {
  private readonly logger = new Logger(PatientCommsAgent.name);

  readonly id = 'patient_comms' as const;
  readonly name = 'PatientCommsAgent';
  readonly defaultModel: ModelId = 'anthropic.claude-sonnet-4-7';
  readonly defaultTemperature = 0.3;

  constructor(private readonly bedrock: BedrockService) {}

  async run(
    input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult> {
    const userMessage = JSON.stringify({
      caseId: ctx.caseId,
      procedureDescription: ctx.procedureDescription ?? null,
      message: (input.payload as { message?: unknown }).message ?? null,
      thread: (input.payload as { thread?: unknown }).thread ?? [],
    });

    let draft: PatientCommsDraft = BASELINE;
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
        const validated = draftSchema.safeParse(parsed);
        if (validated.success) {
          draft = validated.data;
        } else {
          this.logger.warn(
            `PatientComms JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `PatientComms Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    // Logistical replies with high confidence don't need a reviewer
    // signature; the coordinator can still glance at it but the run
    // closes as 'n_a'. Anything else holds for HITL.
    const isPureLogistics =
      draft.action === 'reply' &&
      draft.confidence === 'high' &&
      (draft.sensitiveTopics?.length ?? 0) === 0;

    return {
      output: { ...draft, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: isPureLogistics ? 'n_a' : 'pending',
      summary: usedStub
        ? `Baseline patient-comms response (Bedrock stub, escalated).`
        : `Drafted ${draft.action} reply (confidence=${draft.confidence}).`,
    };
  }
}
