/**
 * AthenaHttpService — resilient fetch wrapper with:
 *
 *  - automatic Bearer-token injection from AthenaAuthService
 *  - single-retry on 401 (re-mint token) — handles race between cache
 *    TTL and Athena's own expiry clock
 *  - exponential backoff with jitter on 429 / 5xx (max 3 attempts)
 *  - correlation-id header forwarded for cross-service traces
 *  - per-request timeout (default 10s)
 *
 * Downstream clients (AthenaFhirClient, later athenaOne wrappers)
 * just call `http.get('Patient', { params: { … }})` and get a
 * validated JSON back, no token plumbing needed.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AthenaAuthService } from './athena-auth.service';

export interface AthenaRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly params?: Record<string, string | string[] | number | undefined>;
  readonly body?: unknown;
  readonly correlationId?: string;
  readonly timeoutMs?: number;
  /** Override the base URL (FHIR vs athenaOne). Defaults to caller arg. */
  readonly baseUrl: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

@Injectable()
export class AthenaHttpService {
  private readonly logger = new Logger(AthenaHttpService.name);

  constructor(private readonly auth: AthenaAuthService) {}

  async request<T>(path: string, opts: AthenaRequestOptions): Promise<T> {
    const url = this.buildUrl(opts.baseUrl, path, opts.params);
    const correlationId = opts.correlationId ?? randomUUID();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const token = await this.auth.getAccessToken();
        const res = await this.doFetch(url, opts, token, correlationId, timeoutMs);

        if (res.ok) {
          // 204 No Content path used by some writes; returns empty body.
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        }

        // Token likely stale — retry once with a fresh mint.
        if (res.status === 401 && attempt === 1) {
          this.logger.warn(`Athena 401 on ${opts.method ?? 'GET'} ${path}; re-minting token`);
          await this.auth.getAccessToken(); // force cache miss path via our TTL logic
          continue;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
          const delay = backoffMs(attempt);
          this.logger.warn(
            `Athena ${res.status} on ${path}; retrying in ${delay}ms (attempt ${attempt})`,
          );
          await sleep(delay);
          continue;
        }

        const bodyHint = await res.text().catch(() => '');
        throw new AthenaApiError(res.status, path, bodyHint.slice(0, 500));
      } catch (err) {
        if (err instanceof AthenaApiError) throw err;
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_ATTEMPTS) {
          const delay = backoffMs(attempt);
          this.logger.warn(
            `Athena network error on ${path}: ${lastErr.message}; retry in ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }
      }
    }
    throw new ServiceUnavailableException(
      `athena unreachable after ${MAX_ATTEMPTS} attempts: ${lastErr?.message ?? 'unknown'}`,
    );
  }

  private buildUrl(
    baseUrl: string,
    path: string,
    params?: AthenaRequestOptions['params'],
  ): string {
    const url = new URL(path.replace(/^\//, ''), `${baseUrl}/`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, String(item));
        else url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async doFetch(
    url: string,
    opts: AthenaRequestOptions,
    token: string,
    correlationId: string,
    timeoutMs: number,
  ): Promise<Response> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: opts.method ?? 'GET',
        headers: {
          Accept: 'application/fhir+json, application/json',
          Authorization: `Bearer ${token}`,
          'x-correlation-id': correlationId,
          ...(opts.body !== undefined ? { 'Content-Type': 'application/fhir+json' } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  }
}

export class AthenaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyHint: string,
  ) {
    super(`Athena ${status} on ${path}: ${bodyHint}`);
    this.name = 'AthenaApiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  // Exponential with full jitter, capped at 2s.
  const cap = 2_000;
  const base = 200 * 2 ** (attempt - 1);
  return Math.min(cap, Math.floor(Math.random() * base));
}
