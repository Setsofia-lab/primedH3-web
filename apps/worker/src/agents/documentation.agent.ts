/**
 * DocumentationAgent (Constitution §4 Agent 8).
 *
 * Trigger: manual from /app/admin/cases/[id]; future hooks for "draft
 *          op-note when surgery_date approaches" land in M16.
 *
 * Output: a structured clinical document (H&P, op-note, consult note,
 *         or discharge summary) with the standard SOAP-ish sections.
 *         hitlStatus='pending' always — the surgeon signs the final
 *         document via the documents panel; this is just the draft.
 *
 * Hard-stops: NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF means we never
 * mark the document as "sent" / "signed" / "delivered". Field names
 * stay drafts until the human acts.
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

const DOC_KINDS = ['h_and_p', 'op_note', 'consult_note', 'discharge_summary'] as const;
const SECTIONS = [
  'chief_complaint',
  'hpi',
  'past_medical_history',
  'past_surgical_history',
  'medications',
  'allergies',
  'social_history',
  'family_history',
  'review_of_systems',
  'physical_exam',
  'assessment',
  'plan',
  'procedure_indication',
  'procedure_description',
  'findings',
  'specimens',
  'estimated_blood_loss',
  'disposition',
] as const;

const sectionSchema = z.object({
  key: z.enum(SECTIONS),
  heading: z.string().min(1).max(120),
  body: z.string().min(1).max(20_000),
});

const draftSchema = z.object({
  kind: z.enum(DOC_KINDS),
  title: z.string().min(1).max(200),
  sections: z.array(sectionSchema).min(2).max(20),
  /** Free-form note for the reviewer about what's still missing. */
  reviewerFocus: z.string().max(2000),
  /** Pending citations the reviewer should chase down before signing. */
  citationsNeeded: z.array(z.string().max(400)).max(20).optional(),
});
export type DocumentDraft = z.infer<typeof draftSchema>;

const BASELINE: DocumentDraft = {
  kind: 'h_and_p',
  title: 'Pre-operative History & Physical (draft)',
  sections: [
    {
      key: 'chief_complaint',
      heading: 'Chief Complaint',
      body: 'Patient referred for elective surgical evaluation per surgeon request.',
    },
    {
      key: 'hpi',
      heading: 'History of Present Illness',
      body:
        'Bedrock stubbed — full HPI requires chart context (Athena read pending). ' +
        'Surgeon to dictate or import existing referral note before signing.',
    },
    {
      key: 'past_medical_history',
      heading: 'Past Medical History',
      body: 'Pending chart import.',
    },
    {
      key: 'medications',
      heading: 'Medications',
      body: 'Pending chart import. Confirm with patient at pre-op visit.',
    },
    {
      key: 'allergies',
      heading: 'Allergies',
      body: 'Pending chart import.',
    },
    {
      key: 'physical_exam',
      heading: 'Physical Examination',
      body: 'To be completed at pre-op visit.',
    },
    {
      key: 'assessment',
      heading: 'Assessment',
      body:
        'Patient referred for elective procedure as documented in the case record. ' +
        'Pre-op workup in progress; awaiting risk screen + anesthesia clearance.',
    },
    {
      key: 'plan',
      heading: 'Plan',
      body:
        'Continue scheduled pre-op workup tasks. Surgeon to review and sign this H&P after final assessment.',
    },
  ],
  reviewerFocus:
    'Replace placeholders with chart-imported content. Do not sign until HPI, PMH, Meds, Allergies, and PE sections are complete.',
  citationsNeeded: [
    'Athena chart pull for problem list + active medications',
    'Pre-anesthesia visit notes (when available)',
  ],
};

const SYSTEM_PROMPT = `You are PrimedHealth's DocumentationAgent. You DRAFT clinical
documents (H&P, op-note, consult note, discharge summary) for a
provider to review and sign. Never assert a document is signed.

Inputs (user message JSON):
  - kind: "h_and_p"|"op_note"|"consult_note"|"discharge_summary"
  - procedureCode, procedureDescription
  - patient: { dob, sex, mrn? }
  - chart: optional structured pull (problem list, meds, allergies, ROS)
  - dictation: optional free text the surgeon already entered

Output a JSON object (and ONLY JSON):
{
  "kind": "...",
  "title": "...",
  "sections": [
    { "key": "<one of the SECTIONS enum>", "heading": "...", "body": "..." }
  ],
  "reviewerFocus": "...",
  "citationsNeeded": [ "..." ]
}

Rules:
  - Never claim the document is signed / sent / submitted.
  - Never name a specific medication or dosage unless it appears in
    the input chart pull verbatim. Use "patient's current medications".
  - For an H&P, include at minimum: chief_complaint, hpi,
    past_medical_history, medications, allergies, physical_exam,
    assessment, plan.
  - For an op_note, include: procedure_indication, procedure_description,
    findings, specimens, estimated_blood_loss, disposition, plan.
  - When data is missing, write "Pending chart import" in the body
    and add an item to \`citationsNeeded\` — do NOT fabricate.
  - Keep each section body ≤ 1500 words.`;

@Injectable()
export class DocumentationAgent implements Agent {
  private readonly logger = new Logger(DocumentationAgent.name);

  readonly id = 'documentation' as const;
  readonly name = 'DocumentationAgent';
  readonly defaultModel: ModelId = 'anthropic.claude-sonnet-4-7';
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
      kind: (input.payload as { kind?: unknown }).kind ?? 'h_and_p',
      payload: input.payload,
    });

    let draft: DocumentDraft = BASELINE;
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
        maxTokens: 4500,
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
            `Documentation JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Documentation Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: { ...draft, usedStub },
      promptTokens,
      completionTokens,
      costUsdMicros,
      hitlStatus: 'pending',
      summary: usedStub
        ? `Baseline ${draft.kind} document draft (Bedrock stub).`
        : `Drafted ${draft.kind} (${draft.sections.length} sections).`,
    };
  }
}
