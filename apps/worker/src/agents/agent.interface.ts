/**
 * Agent contract — Constitution §4.
 *
 * Every agent (IntakeOrchestrator, RiskScreening, etc.) implements
 * `run(input, ctx)` and is registered with `AgentDispatcherService`
 * keyed by `id` (e.g. 'intake_orchestrator').
 *
 * Rules:
 *   - Inputs come from SQS messages emitted by the api on domain
 *     events. The dispatcher routes by `agentId` in the message.
 *   - Every run records to the `agent_runs` table — input, output,
 *     tool calls, latency, tokens, cost, hitl_status.
 *   - Clinical recommendations end pending HITL approval (Constitution
 *     §5.3 hard rule). The agent sets `hitlStatus = 'pending'` on
 *     anything that needs sign-off; humans flip to `approved` from the
 *     UI.
 *   - Hard-stop policies (`NEVER_AUTO_CLEAR_PATIENT`,
 *     `NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF`) are enforced by the
 *     dispatcher before the agent's output is persisted.
 */

export type AgentId =
  | 'intake_orchestrator'
  | 'risk_screening'
  | 'anesthesia_clearance'
  | 'referral'
  | 'scheduling'
  | 'patient_comms'
  | 'pre_hab'
  | 'documentation'
  | 'task_tracker'
  | 'readiness';

/**
 * Bedrock model IDs.
 *
 * IMPORTANT: Claude 4.x models on Bedrock require *inference profile*
 * IDs (`us.…` or `global.…` prefix). Direct foundation-model IDs
 * (`anthropic.claude-…`) return ValidationException for on-demand
 * invocation. We pin to the US-region profiles for HIPAA workloads.
 *
 * Sonnet 4.7 doesn't exist on Bedrock as of 2026-04 — the latest
 * Sonnet inference profile is 4.6.
 */
export type ModelId =
  | 'us.anthropic.claude-sonnet-4-6'
  | 'us.anthropic.claude-opus-4-7'
  | 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export interface AgentInput {
  /** What triggered this run (e.g. 'case.created'). */
  readonly triggerEvent: string;
  /** Anything the dispatcher passed through from the SQS message. */
  readonly payload: Record<string, unknown>;
}

/**
 * Optional per-run overrides resolved from the agent_prompts registry.
 * If absent, agents use their hardcoded defaults — keeps the runtime
 * working even when the registry is empty (first deploy, fresh DB).
 */
export interface AgentPromptOverrides {
  readonly systemPrompt?: string;
  readonly model?: ModelId;
  readonly temperature?: number;
}

export interface CaseContext {
  readonly caseId: string;
  readonly facilityId: string;
  readonly patientId: string;
  /** Set when the dispatcher could fetch it cheaply; undefined otherwise. */
  readonly procedureCode?: string | undefined;
  readonly procedureDescription?: string | undefined;
  readonly surgeonId?: string | null;
}

export interface ToolCall {
  readonly tool: string;
  readonly input: Record<string, unknown>;
  readonly output: unknown;
  readonly latencyMs: number;
}

export interface AgentRunResult {
  /** Free-form structured output the agent produced. Schema is per-agent. */
  readonly output: Record<string, unknown>;
  readonly toolCalls?: readonly ToolCall[];
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  /** USD * 1e6 (whole-cent precision lost). 0 when no model call happened. */
  readonly costUsdMicros?: number;
  /** When the agent emits a clinical rec needing review. */
  readonly hitlStatus?: 'pending' | 'n_a';
  /** Plain-language summary for the audit log + admin UI. */
  readonly summary: string;
}

export interface Agent {
  readonly id: AgentId;
  readonly name: string;
  readonly defaultModel: ModelId;
  readonly defaultTemperature: number;

  run(
    input: AgentInput,
    ctx: CaseContext,
    overrides?: AgentPromptOverrides,
  ): Promise<AgentRunResult>;
}
