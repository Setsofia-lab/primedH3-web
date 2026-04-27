/**
 * BedrockService — wraps the Bedrock Runtime client + Anthropic
 * Messages format. We use the Anthropic Messages API directly
 * (`InvokeModelCommand` with the `anthropic.*` model ids) instead of
 * a thicker wrapper so we keep full control over caching headers,
 * tool-use payloads, and prompt-version tracking.
 *
 * If `AWS_BEDROCK_DISABLED=1` is set (or the call returns
 * AccessDeniedException because model access isn't enabled in the
 * AWS console yet), the service falls back to a deterministic stub so
 * the agent loop is testable without Bedrock provisioned.
 *
 * Cost accounting: the response carries `usage.input_tokens` and
 * `usage.output_tokens`; we convert to USD via a hardcoded price table
 * (Bedrock prices change rarely). Stored as integer micro-cents on
 * `agent_runs.totalCostUsdMicros`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AsyncLocalStorage } from 'node:async_hooks';

import type { ModelId } from '../agents/agent.interface';
import { LangSmithTracer } from '../observability/langsmith-tracer';

/**
 * Run-context for tracing. The dispatcher calls
 * `BedrockService.runInAgentContext({ agentId, runId }, () => agent.run(...))`
 * and BedrockService.messages picks the context up via ALS without
 * every agent having to thread `trace` through its signature.
 */
interface AgentRunContext {
  readonly agentId: string;
  readonly runId: string;
}

const agentRunCtx = new AsyncLocalStorage<AgentRunContext>();

interface MessagesRequest {
  readonly model: ModelId;
  readonly system: string;
  readonly messages: ReadonlyArray<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  readonly temperature: number;
  readonly maxTokens?: number;
}

export interface MessagesResponse {
  readonly text: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsdMicros: number;
  /** True when we returned a stub because Bedrock wasn't reachable. */
  readonly stub: boolean;
}

// USD per 1M tokens — matches Anthropic public Bedrock pricing
// (refresh when invoiced rates change). Values are in whole dollars.
const PRICING: Record<ModelId, { input: number; output: number }> = {
  'anthropic.claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'anthropic.claude-sonnet-4-7': { input: 3.0, output: 15.0 },
  'anthropic.claude-opus-4-7': { input: 15.0, output: 75.0 },
};

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly forceStub: boolean;
  private readonly guardrailId: string | null;
  private readonly guardrailVersion: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly tracer: LangSmithTracer,
  ) {
    const region =
      this.config.get<string>('AWS_REGION') ??
      this.config.get<string>('BEDROCK_REGION') ??
      'us-east-1';
    this.client = new BedrockRuntimeClient({ region });
    this.forceStub = this.config.get<string>('AWS_BEDROCK_DISABLED') === '1';
    if (this.forceStub) {
      this.logger.warn('Bedrock disabled via AWS_BEDROCK_DISABLED=1 — using stub responses');
    }
    this.guardrailId = this.config.get<string>('BEDROCK_GUARDRAIL_ID') ?? null;
    this.guardrailVersion = this.config.get<string>('BEDROCK_GUARDRAIL_VERSION') ?? null;
    if (this.guardrailId && this.guardrailVersion) {
      this.logger.log(
        `Bedrock Guardrails enabled (id=${this.guardrailId}, version=${this.guardrailVersion})`,
      );
    }
  }

  /**
   * Wrap an agent.run() call so messages() emitted inside it are
   * traced back to the run row. Pure pass-through when there's no
   * tracer — the ALS overhead is negligible.
   */
  runInAgentContext<T>(ctx: AgentRunContext, fn: () => Promise<T>): Promise<T> {
    return agentRunCtx.run(ctx, fn);
  }

  async messages(req: MessagesRequest): Promise<MessagesResponse> {
    const startedAt = Date.now();
    const trace = agentRunCtx.getStore() ?? null;
    const userMessageBlob = JSON.stringify(req.messages);
    const exec = async (): Promise<MessagesResponse & { latencyMs: number }> => {
      if (this.forceStub) {
        const stubResp = this.stub(req, 'forced');
        return { ...stubResp, latencyMs: Date.now() - startedAt };
      }
      try {
        const body = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: req.maxTokens ?? 1024,
          temperature: req.temperature,
          system: req.system,
          messages: req.messages.map((m) => ({
            role: m.role,
            content: [{ type: 'text', text: m.content }],
          })),
        };
        // Guardrails apply only when both id + version are set; the
        // model role must hold bedrock:ApplyGuardrail (granted in
        // AgentStack). On a guardrail block, Bedrock still responds 200
        // but `decoded.amazon-bedrock-guardrailAction` will be 'INTERVENED'
        // and the model output is replaced with the guardrail's
        // configured `blockedOutputsMessaging`.
        const out = await this.client.send(
          new InvokeModelCommand({
            modelId: req.model,
            body: JSON.stringify(body),
            contentType: 'application/json',
            accept: 'application/json',
            ...(this.guardrailId && this.guardrailVersion
              ? {
                  guardrailIdentifier: this.guardrailId,
                  guardrailVersion: this.guardrailVersion,
                }
              : {}),
          }),
        );
        const decoded = JSON.parse(Buffer.from(out.body).toString('utf8')) as {
          content: { type: string; text: string }[];
          usage: { input_tokens: number; output_tokens: number };
          'amazon-bedrock-guardrailAction'?: string;
        };
        const text = decoded.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('');
        if (decoded['amazon-bedrock-guardrailAction'] === 'INTERVENED') {
          this.logger.warn(
            `Bedrock Guardrails intervened on ${req.model}; output replaced with safe message.`,
          );
        }
        const promptTokens = decoded.usage.input_tokens;
        const completionTokens = decoded.usage.output_tokens;
        const costUsdMicros = priceMicros(req.model, promptTokens, completionTokens);
        return {
          text,
          promptTokens,
          completionTokens,
          costUsdMicros,
          stub: false,
          latencyMs: Date.now() - startedAt,
        };
      } catch (err) {
        const e = err as { name?: string; message?: string };
        if (e.name === 'AccessDeniedException' || e.name === 'ResourceNotFoundException') {
          this.logger.warn(
            `Bedrock model ${req.model} not accessible (${e.name}) — falling back to stub. ` +
              `Enable model access in the AWS console (Bedrock → Model access).`,
          );
          const stubResp = this.stub(req, e.name);
          return { ...stubResp, latencyMs: Date.now() - startedAt };
        }
        throw err;
      }
    };

    if (!trace) {
      const r = await exec();
      return {
        text: r.text,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        costUsdMicros: r.costUsdMicros,
        stub: r.stub,
      };
    }

    const traced = await this.tracer.trace(
      {
        runId: trace.runId,
        agentId: trace.agentId,
        model: req.model,
        system: req.system,
        userMessage: userMessageBlob,
      },
      async () => {
        const r = await exec();
        return {
          text: r.text,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          costUsdMicros: r.costUsdMicros,
          stub: r.stub,
          latencyMs: r.latencyMs,
        };
      },
    );
    return {
      text: traced.text,
      promptTokens: traced.promptTokens,
      completionTokens: traced.completionTokens,
      costUsdMicros: traced.costUsdMicros,
      stub: traced.stub,
    };
  }

  private stub(req: MessagesRequest, reason: string): MessagesResponse {
    return {
      text:
        `[stub] Bedrock not reachable (${reason}). ` +
        `Would have invoked ${req.model} with system="${req.system.slice(0, 80)}…"`,
      promptTokens: 0,
      completionTokens: 0,
      costUsdMicros: 0,
      stub: true,
    };
  }
}

function priceMicros(model: ModelId, input: number, output: number): number {
  const p = PRICING[model];
  // Token prices are per 1,000,000 tokens; we want USD * 1e6 = micros.
  // micros = (input * inputPricePerM + output * outputPricePerM)
  // (the *1e6 cancels with the /1e6 from "per million tokens").
  return Math.round(input * p.input + output * p.output);
}
