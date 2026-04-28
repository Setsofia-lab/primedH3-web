/**
 * RiskScreeningAgent (Constitution §4 Agent 2).
 *
 * Trigger: case.created (and on demand from the admin panel)
 * Output: an NSQIP-style risk profile across the major peri-op
 *         categories (cardiac, pulmonary, renal, hepatic, hemolytic,
 *         infection, anesthesia, surgical site). Each entry has a
 *         numeric severity score, the supporting reasoning, and a
 *         mitigation suggestion the surgeon can accept or reject.
 *
 * Discipline:
 *   - The agent NEVER emits a clearance verdict — that's a hard-stop
 *     (NEVER_AUTO_CLEAR_PATIENT) enforced by the dispatcher. The
 *     prompt is explicit; the deny-list is a backstop.
 *   - Output is always pending HITL. A reviewer flips approved/
 *     declined from /app/admin/agents.
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

const RISK_CATEGORIES = [
  'cardiac',
  'pulmonary',
  'renal',
  'hepatic',
  'hematologic',
  'endocrine',
  'neurologic',
  'nutritional',
  'infection',
  'anesthesia',
  'surgical_site',
] as const;

const SEVERITY_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;

const riskItemSchema = z.object({
  category: z.enum(RISK_CATEGORIES),
  name: z.string().min(1).max(120),
  /** Continuous score in [0,1]. 0 = no concern, 1 = critical. */
  score: z.number().min(0).max(1),
  severity: z.enum(SEVERITY_LEVELS),
  reasoning: z.string().min(1).max(2000),
  mitigation: z.string().max(2000).optional(),
});

const profileSchema = z.object({
  risks: z.array(riskItemSchema).min(1).max(40),
  /** Aggregate of the per-item scores, computed by the model. [0,1] */
  overallScore: z.number().min(0).max(1),
  summary: z.string().min(1).max(4000),
  /**
   * The agent must never assert a clearance verdict. We surface what
   * the reviewer should look at. Free text, validated by the
   * dispatcher's hard-stop policy as a backstop.
   */
  reviewerFocus: z.string().max(2000).optional(),
});
export type RiskProfile = z.infer<typeof profileSchema>;

/** Deterministic baseline used when Bedrock is stubbed or fails. */
const BASELINE: RiskProfile = {
  risks: [
    {
      category: 'anesthesia',
      name: 'Standard ASA review pending',
      score: 0.2,
      severity: 'low',
      reasoning:
        'No model-driven screen available; baseline assumes a routine anesthesia review is required.',
      mitigation: 'Schedule pre-anesthesia visit; collect STOP-BANG.',
    },
    {
      category: 'cardiac',
      name: 'RCRI not yet calculated',
      score: 0.2,
      severity: 'low',
      reasoning: 'Need patient comorbidities and EKG before scoring RCRI.',
      mitigation: 'Order EKG within 30d of surgery; review history.',
    },
    {
      category: 'surgical_site',
      name: 'MRSA screen pending if implant case',
      score: 0.1,
      severity: 'low',
      reasoning: 'Procedure-dependent; flag for orthopedic / cardiothoracic implants.',
      mitigation: 'If implantable, run MRSA nares swab 7d pre-op.',
    },
  ],
  overallScore: 0.2,
  summary:
    'Baseline screen — Bedrock stubbed. No high-risk findings; standard pre-op workup applies. Reviewer should run the full screen once model access is enabled.',
  reviewerFocus:
    'Confirm history-of-present-illness in chart; verify no missing comorbidities before promoting to active workup.',
};

const SYSTEM_PROMPT = `You are PrimedHealth's RiskScreeningAgent. Your job is to produce a
peri-operative risk profile (NSQIP-style) for a surgical case, NOT to
clear or approve the patient. A human provider always reviews.

Inputs you'll receive (in the user message as JSON):
  - procedureCode: CPT or null
  - procedureDescription: string or null
  - patient: { dob, sex, mrn? }     // demographics only for now
  - facility: { name, timezone }    // optional

Output a JSON object (and ONLY JSON) of the form:
{
  "risks": [
    {
      "category": "cardiac" | "pulmonary" | "renal" | "hepatic" |
                  "hematologic" | "endocrine" | "neurologic" |
                  "nutritional" | "infection" | "anesthesia" |
                  "surgical_site",
      "name": "...",                  // <= 120 chars
      "score": <number 0..1>,         // 0=none, 1=critical
      "severity": "low"|"moderate"|"high"|"critical",
      "reasoning": "...",             // why this risk applies
      "mitigation": "..."             // optional, the action to take
    }
  ],
  "overallScore": <number 0..1>,
  "summary": "...",                   // 2-4 sentences for the chart
  "reviewerFocus": "..."              // optional, what the reviewer must verify
}

Rules:
  - Cover at least cardiac, pulmonary, anesthesia, and surgical_site.
  - Never assert "cleared", "approved for surgery", or any synonym.
    Use "low risk" / "no concerns identified" instead.
  - Do not recommend medications by name; mitigations should be
    process-level (e.g. "schedule cardiology consult", "STOP-BANG
    survey").
  - Severity bands: low (<0.25), moderate (0.25-0.5), high (0.5-0.8),
    critical (>0.8).
  - Score should reflect the available evidence; if the patient
    history is empty, default to "low" with a note that more chart
    context is needed.
  - Keep \`risks\` under 15 items.`;

@Injectable()
export class RiskScreeningAgent implements Agent {
  private readonly logger = new Logger(RiskScreeningAgent.name);

  readonly id = 'risk_screening' as const;
  readonly name = 'RiskScreeningAgent';
  readonly defaultModel: ModelId = 'us.anthropic.claude-opus-4-7';
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

    let profile: RiskProfile = BASELINE;
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
        maxTokens: 3500,
      });
      promptTokens = res.promptTokens;
      completionTokens = res.completionTokens;
      costUsdMicros = res.costUsdMicros;
      usedStub = res.stub;

      if (!res.stub) {
        const parsed = parseModelJson(res.text);
        const validated = profileSchema.safeParse(parsed);
        if (validated.success) {
          profile = validated.data;
        } else {
          this.logger.warn(
            `RiskScreening JSON failed schema, falling back to baseline: ${validated.error.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `RiskScreening Bedrock call failed; using baseline: ${(err as Error).message}`,
      );
    }

    return {
      output: {
        risks: profile.risks,
        overallScore: profile.overallScore,
        summary: profile.summary,
        reviewerFocus: profile.reviewerFocus,
        usedStub,
      },
      promptTokens,
      completionTokens,
      costUsdMicros,
      // Risk recommendations always need human sign-off.
      hitlStatus: 'pending',
      summary: usedStub
        ? `Baseline ${profile.risks.length}-item risk screen (Bedrock stub).`
        : `Generated ${profile.risks.length}-item risk profile (overall ${(
            profile.overallScore * 100
          ).toFixed(0)}%).`,
    };
  }
}

