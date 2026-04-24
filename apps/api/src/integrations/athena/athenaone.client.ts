/**
 * AthenaOneClient — proprietary athenaOne REST endpoints.
 *
 * URL shape (from docs.athenahealth.com/api/workflows/*):
 *
 *   GET {baseUrl}/v1/{practiceid}/departments
 *   GET {baseUrl}/v1/{practiceid}/providers
 *   GET {baseUrl}/v1/{practiceid}/chart/configuration/vitals
 *   GET {baseUrl}/v1/{practiceid}/appointments/open
 *   GET {baseUrl}/v1/{practiceid}/patients/{patientid}/medicalhistory
 *   ...
 *
 * Practice id goes in the path; every call needs one. We default to
 * `ATHENA_DEFAULT_PRACTICE_ID` but accept an override per call so we
 * can serve different facilities from a single task.
 *
 * Most athenaOne responses are ad-hoc JSON shapes per endpoint, not
 * FHIR bundles. This client stays untyped at the wire layer; service-
 * layer wrappers above it are responsible for Zod-validating each
 * specific call's response.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AthenaHttpService } from './athena-http.service';
import { ATHENA_CONFIG_TOKEN, type AthenaResolvedConfig } from './athena.tokens';

export interface AthenaOneRequestOptions {
  /** Override the default practice. */
  readonly practiceId?: string;
  /** Query-string params (practiceid already in path; don't duplicate it). */
  readonly params?: Record<string, string | number | string[] | undefined>;
  /** For POST/PUT/DELETE. */
  readonly body?: unknown;
  readonly correlationId?: string;
  readonly timeoutMs?: number;
}

@Injectable()
export class AthenaOneClient {
  constructor(
    private readonly http: AthenaHttpService,
    @Inject(ATHENA_CONFIG_TOKEN) private readonly config: AthenaResolvedConfig | null,
  ) {}

  get<T>(path: string, opts: AthenaOneRequestOptions = {}): Promise<T> {
    return this.http.request<T>(this.pathWithPractice(path, opts.practiceId), {
      method: 'GET',
      baseUrl: this.base(),
      ...(opts.params !== undefined ? { params: opts.params } : {}),
      ...(opts.correlationId !== undefined ? { correlationId: opts.correlationId } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
  }

  post<T>(path: string, opts: AthenaOneRequestOptions = {}): Promise<T> {
    return this.http.request<T>(this.pathWithPractice(path, opts.practiceId), {
      method: 'POST',
      baseUrl: this.base(),
      ...(opts.body !== undefined ? { body: opts.body } : {}),
      ...(opts.params !== undefined ? { params: opts.params } : {}),
      ...(opts.correlationId !== undefined ? { correlationId: opts.correlationId } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
  }

  // ---- internals ----

  private base(): string {
    if (!this.config) throw new Error('athena not configured');
    // athenaOneBaseUrl is `{baseUrl}/v1`; we append `/{practiceid}/{path}`.
    return this.config.athenaOneBaseUrl;
  }

  private pathWithPractice(path: string, practiceId?: string): string {
    const pid = practiceId ?? this.config?.defaultPracticeId;
    if (!pid) throw new Error('no practice id configured');
    const stripped = path.replace(/^\/+/, '');
    return `${pid}/${stripped}`;
  }
}
