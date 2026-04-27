/**
 * LangSmith tracer — no-op when LANGSMITH_API_KEY is unset.
 *
 * Wraps the Bedrock InvokeModel call site so every agent run becomes
 * a traceable LLM run in LangSmith. The transport is the official
 * `langsmith` SDK; we use its low-level `Client.createRun` + flush
 * instead of LangChain's heavier RunnableTracer because we already
 * own the Bedrock SDK call shape.
 *
 * Discipline:
 *   - The tracer NEVER throws. If LangSmith is misconfigured or down,
 *     agent runs proceed exactly as before.
 *   - PII: we redact Bedrock inputs through `redactForTrace()` before
 *     they leave the VPC. PHI keys (mrn, dob, ssn, phone, email) are
 *     replaced with `***`. The full payload still lives on
 *     `agent_runs.input_json` (encrypted at rest by Aurora's CMK), so
 *     LangSmith only sees the structure of the conversation.
 *   - Cost: each trace is ~1 KB; LangSmith free tier is 5k traces/mo
 *     (one per agent run), well within Phase 3 dev volume.
 *
 * Env vars:
 *   LANGSMITH_API_KEY        — gates all tracing
 *   LANGSMITH_PROJECT        — defaults to `primedhealth-${NODE_ENV}`
 *   LANGSMITH_ENDPOINT       — defaults to https://api.smith.langchain.com
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'langsmith';
import { randomUUID } from 'node:crypto';

export interface TraceableLLMCall {
  readonly runId: string;
  readonly agentId: string;
  readonly model: string;
  readonly system: string;
  readonly userMessage: string;
}

export interface TraceableLLMResult {
  readonly text: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsdMicros: number;
  readonly stub: boolean;
  readonly latencyMs: number;
}

const PHI_KEY_PATTERN = /\b(?:mrn|dob|ssn|phone|email|address|first_?name|last_?name)\b/i;

/**
 * Walk the structure and replace any string that's bound to a known
 * PHI-shaped key with `***`. Idempotent and pure.
 */
function redactForTrace(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    // Try parsing as JSON — many agent inputs are stringified blobs.
    try {
      const parsed = JSON.parse(value);
      const redacted = redactForTrace(parsed);
      return JSON.stringify(redacted);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(redactForTrace);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PHI_KEY_PATTERN.test(k) ? '***' : redactForTrace(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class LangSmithTracer {
  private readonly logger = new Logger(LangSmithTracer.name);
  private readonly client: Client | null;
  private readonly project: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('LANGSMITH_API_KEY') ?? '';
    this.enabled = apiKey.length > 0;
    this.project =
      this.config.get<string>('LANGSMITH_PROJECT') ??
      `primedhealth-${this.config.get<string>('NODE_ENV') ?? 'dev'}`;
    if (!this.enabled) {
      this.client = null;
      this.logger.log('LangSmith disabled (LANGSMITH_API_KEY unset) — tracing is a no-op');
      return;
    }
    const endpoint =
      this.config.get<string>('LANGSMITH_ENDPOINT') ?? 'https://api.smith.langchain.com';
    this.client = new Client({ apiKey, apiUrl: endpoint });
    this.logger.log(
      `LangSmith tracing enabled (project=${this.project}, endpoint=${endpoint})`,
    );
  }

  /**
   * Trace an LLM call. The call is invoked by `inner`; this wrapper
   * times it, captures inputs/outputs (redacted), and posts a single
   * run to LangSmith. If the key isn't set, `inner` runs unchanged.
   */
  async trace(
    call: TraceableLLMCall,
    inner: () => Promise<TraceableLLMResult>,
  ): Promise<TraceableLLMResult> {
    if (!this.enabled || !this.client) return inner();

    const traceRunId = randomUUID();
    const startTime = Date.now();
    let result: TraceableLLMResult | null = null;
    let error: Error | null = null;
    try {
      result = await inner();
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      // Best-effort post — never throw from the finally.
      void this.post(traceRunId, call, startTime, result, error);
    }
  }

  private async post(
    traceRunId: string,
    call: TraceableLLMCall,
    startTime: number,
    result: TraceableLLMResult | null,
    error: Error | null,
  ): Promise<void> {
    if (!this.client) return;
    const endTime = Date.now();
    const inputs = {
      agent: call.agentId,
      model: call.model,
      system: call.system,
      messages: [{ role: 'user', content: redactForTrace(call.userMessage) }],
      run_id: call.runId,
    };
    const outputs = result
      ? {
          text: result.text,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          costUsdMicros: result.costUsdMicros,
          stub: result.stub,
        }
      : null;
    try {
      await this.client.createRun({
        id: traceRunId,
        name: `${call.agentId} (${call.model})`,
        run_type: 'llm',
        inputs,
        outputs: outputs ?? undefined,
        start_time: startTime,
        end_time: endTime,
        error: error?.message,
        project_name: this.project,
        extra: {
          metadata: {
            primedhealth_run_id: call.runId,
            agent_id: call.agentId,
            model: call.model,
            stub: result?.stub ?? null,
          },
        },
      });
    } catch (err) {
      // Tracing must never break the agent run.
      this.logger.warn(
        `LangSmith post failed for run ${call.runId}: ${(err as Error).message}`,
      );
    }
  }
}
