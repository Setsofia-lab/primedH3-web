/**
 * Shared types — generated from the api's OpenAPI spec.
 *
 * The whole `paths` + `components` tree lives in `api-types.d.ts`,
 * regenerated via:
 *
 *     pnpm -F @primedhealth/api openapi:emit
 *     pnpm -F @primedhealth/shared-types gen
 *
 * (CI runs both before the web build so types never drift.)
 *
 * Web + worker consumers can either:
 *   - import the curated aliases below, or
 *   - reach into `paths` / `components` directly for per-endpoint
 *     request/response/parameter shapes.
 */
import type { paths, components } from './api-types';

export type { paths, components };

// ---- Schema-level aliases (server-authoritative) ------------------

type Schemas = components['schemas'];

// We don't pre-export every schema name — most don't need it, and
// keeping the surface narrow avoids regen-drift breakage. Add an
// alias when a consumer reaches for a type more than once.
export type Schema<K extends keyof Schemas> = Schemas[K];

// ---- Endpoint helpers ---------------------------------------------

/** Body shape for a JSON POST/PATCH endpoint. */
export type RequestBody<P extends keyof paths, M extends keyof paths[P]> =
  paths[P][M] extends {
    requestBody?: { content: { 'application/json': infer B } };
  }
    ? B
    : never;

/** 200 (or 201 on POST) JSON response shape for an endpoint. */
export type Response2xx<P extends keyof paths, M extends keyof paths[P]> =
  paths[P][M] extends {
    responses: { 200: { content: { 'application/json': infer R } } };
  }
    ? R
    : paths[P][M] extends {
        responses: { 201: { content: { 'application/json': infer R } } };
      }
    ? R
    : never;

// Convenience: the /health response. Used by web's homepage banner.
export type ApiHealth = Response2xx<'/health', 'get'>;
