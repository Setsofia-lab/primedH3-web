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

import type { ModelId } from '../agents/agent.interface';

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

  constructor(private readonly config: ConfigService) {
    const region =
      this.config.get<string>('AWS_REGION') ??
      this.config.get<string>('BEDROCK_REGION') ??
      'us-east-1';
    this.client = new BedrockRuntimeClient({ region });
    this.forceStub = this.config.get<string>('AWS_BEDROCK_DISABLED') === '1';
    if (this.forceStub) {
      this.logger.warn('Bedrock disabled via AWS_BEDROCK_DISABLED=1 — using stub responses');
    }
  }

  async messages(req: MessagesRequest): Promise<MessagesResponse> {
    if (this.forceStub) {
      return this.stub(req, 'forced');
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
      const out = await this.client.send(
        new InvokeModelCommand({
          modelId: req.model,
          body: JSON.stringify(body),
          contentType: 'application/json',
          accept: 'application/json',
        }),
      );
      const decoded = JSON.parse(Buffer.from(out.body).toString('utf8')) as {
        content: { type: string; text: string }[];
        usage: { input_tokens: number; output_tokens: number };
      };
      const text = decoded.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');
      const promptTokens = decoded.usage.input_tokens;
      const completionTokens = decoded.usage.output_tokens;
      const costUsdMicros = priceMicros(req.model, promptTokens, completionTokens);
      return { text, promptTokens, completionTokens, costUsdMicros, stub: false };
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'AccessDeniedException' || e.name === 'ResourceNotFoundException') {
        this.logger.warn(
          `Bedrock model ${req.model} not accessible (${e.name}) — falling back to stub. ` +
            `Enable model access in the AWS console (Bedrock → Model access).`,
        );
        return this.stub(req, e.name);
      }
      throw err;
    }
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
