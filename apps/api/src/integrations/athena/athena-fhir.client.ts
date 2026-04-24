/**
 * AthenaFhirClient — typed read wrappers over Athena's FHIR R4 surface.
 *
 * Every method returns either a single resource (Zod-validated) or a
 * paginated bundle. Pagination follows FHIR's `Bundle.link[rel=next]`
 * href — callers can iterate with `searchAll()` for exhaustive reads
 * or `search()` for a single page.
 *
 * Practice scoping: Athena's FHIR endpoints resolve practice from the
 * auth token's granted practices. We forward `ah-practice` as a header
 * for safety — Athena accepts either pattern and the header is explicit.
 *
 * Only read operations are implemented here. Write-back to Athena is
 * architecturally deferred (ADR 0002 — PrimedHealth owns the pre-op
 * workflow record; Athena remains the EHR system of record for pre-
 * existing clinical data).
 */
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AthenaHttpService } from './athena-http.service';
import { ATHENA_CONFIG_TOKEN, type AthenaResolvedConfig } from './athena.tokens';

// ---- Minimal FHIR type shims (we validate shape, not every field) ----

const zResourceRef = z
  .object({
    reference: z.string().optional(),
    display: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const zCodeableConcept = z
  .object({
    coding: z
      .array(
        z
          .object({
            system: z.string().optional(),
            code: z.string().optional(),
            display: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    text: z.string().optional(),
  })
  .passthrough();

const zHumanName = z
  .object({
    family: z.string().optional(),
    given: z.array(z.string()).optional(),
    text: z.string().optional(),
    use: z.string().optional(),
  })
  .passthrough();

export const zFhirPatient = z
  .object({
    resourceType: z.literal('Patient'),
    id: z.string(),
    name: z.array(zHumanName).optional(),
    gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
    birthDate: z.string().optional(), // YYYY-MM-DD
    active: z.boolean().optional(),
    identifier: z
      .array(
        z
          .object({
            system: z.string().optional(),
            value: z.string().optional(),
            use: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    telecom: z
      .array(
        z
          .object({
            system: z.string().optional(),
            value: z.string().optional(),
            use: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    address: z
      .array(
        z
          .object({
            line: z.array(z.string()).optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            postalCode: z.string().optional(),
            country: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    meta: z
      .object({
        lastUpdated: z.string().optional(),
        versionId: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type FhirPatient = z.infer<typeof zFhirPatient>;

const zFhirBundleEntry = <T extends z.ZodTypeAny>(resource: T) =>
  z
    .object({
      resource,
      fullUrl: z.string().optional(),
      search: z
        .object({
          mode: z.string().optional(),
          score: z.number().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough();

const zFhirBundle = <T extends z.ZodTypeAny>(resource: T) =>
  z
    .object({
      resourceType: z.literal('Bundle'),
      type: z.string(),
      total: z.number().optional(),
      entry: z.array(zFhirBundleEntry(resource)).optional(),
      link: z
        .array(
          z
            .object({
              relation: z.string(),
              url: z.string(),
            })
            .passthrough(),
        )
        .optional(),
    })
    .passthrough();

export type FhirBundle<T> = { entry?: { resource: T }[]; link?: { relation: string; url: string }[] };

// Keep the other FHIR resource types minimal until we actually use them.
const zPassthroughResource = z.object({ resourceType: z.string(), id: z.string().optional() }).passthrough();

// ---- Client ----

export interface SearchPage<T> {
  readonly resources: T[];
  /** Full URL of next page; undefined when there are no more. */
  readonly nextPageUrl: string | undefined;
}

@Injectable()
export class AthenaFhirClient {
  constructor(
    private readonly http: AthenaHttpService,
    @Inject(ATHENA_CONFIG_TOKEN) private readonly config: AthenaResolvedConfig | null,
  ) {}

  // Athena's FHIR requires `ah-practice` on EVERY request as a query
  // parameter. The value is an Organization reference in the form
  // `Organization/a-1.Practice-<practiceid>`. Confirmed against the
  // live Preview sandbox — see docs/ADRs/0002-athena-integration.md.

  // ---- Patient ----

  async getPatient(id: string, practiceId?: string): Promise<FhirPatient> {
    const raw = await this.http.request<unknown>(`Patient/${encodeURIComponent(id)}`, {
      method: 'GET',
      baseUrl: this.fhirBase(),
      params: this.practiceParam(practiceId),
    });
    return zFhirPatient.parse(raw);
  }

  async searchPatients(
    params: Record<string, string | number | undefined>,
    practiceId?: string,
  ): Promise<SearchPage<FhirPatient>> {
    const raw = await this.http.request<unknown>('Patient', {
      method: 'GET',
      baseUrl: this.fhirBase(),
      params: { ...params, ...this.practiceParam(practiceId) },
    });
    const parsed = zFhirBundle(zFhirPatient).parse(raw);
    return {
      resources: parsed.entry?.map((e) => e.resource) ?? [],
      nextPageUrl: parsed.link?.find((l) => l.relation === 'next')?.url,
    };
  }

  // ---- Generic resource search (used by cache warmers for the long tail) ----

  async searchResource<T = unknown>(
    resourceType: string,
    params: Record<string, string | number | undefined>,
    practiceId?: string,
  ): Promise<SearchPage<T>> {
    const raw = await this.http.request<unknown>(resourceType, {
      method: 'GET',
      baseUrl: this.fhirBase(),
      params: { ...params, ...this.practiceParam(practiceId) },
    });
    const parsed = zFhirBundle(zPassthroughResource).parse(raw);
    return {
      resources: (parsed.entry?.map((e) => e.resource) ?? []) as T[],
      nextPageUrl: parsed.link?.find((l) => l.relation === 'next')?.url,
    };
  }

  // ---- internals ----

  private fhirBase(): string {
    if (!this.config) throw new Error('athena not configured');
    return this.config.fhirBaseUrl;
  }

  private practiceParam(practiceId?: string): { 'ah-practice': string } {
    if (!this.config) throw new Error('athena not configured');
    const pid = practiceId ?? this.config.defaultPracticeId;
    return { 'ah-practice': `Organization/a-1.Practice-${pid}` };
  }
}
