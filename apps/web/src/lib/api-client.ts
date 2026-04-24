/**
 * PrimedHealth API typed client.
 *
 * `api-client.generated.ts` is regenerated from the running api's
 * OpenAPI schema via:
 *
 *   API_OPENAPI_URL=https://api.dev.primed.ai/docs/openapi.json \
 *     pnpm --filter @primedhealth/web api-client:generate
 *
 * The generated file is checked into git so local dev + Vercel preview
 * builds don't need a live api to compile.
 *
 * Use `paths` to get route-level typed fetch:
 *
 *   import type { paths } from './api-client.generated';
 *   type HealthResponse =
 *     paths['/health']['get']['responses']['200']['content']['application/json'];
 */
export type { paths, components, operations } from './api-client.generated';
