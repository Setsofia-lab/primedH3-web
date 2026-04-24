/**
 * Zod-validated runtime config.
 *
 * Single source of truth for every env var the api reads. The app fails
 * fast on startup if any required value is missing or malformed — we
 * never want to learn about a missing DATABASE_URL from a 500 at 3 AM.
 */
import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Set via the api's own ENV in ECS (comes from SecretsStack / DataStack outputs later)
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  // App metadata (for OpenAPI + /health)
  SERVICE_NAME: z.string().default('primedhealth-api'),
  SERVICE_VERSION: z.string().default('0.0.0'),

  // Cognito — set by ApiStack. Optional in local dev; when the pool
  // envs are empty, JwtVerifierService refuses every token (every
  // non-@Public() route → 401). Safe closed-by-default.
  COGNITO_REGION: z.string().optional(),
  COGNITO_ADMINS_POOL_ID: z.string().optional(),
  COGNITO_ADMINS_CLIENT_ID: z.string().optional(),
  COGNITO_PROVIDERS_POOL_ID: z.string().optional(),
  COGNITO_PROVIDERS_CLIENT_ID: z.string().optional(),
  COGNITO_PATIENTS_POOL_ID: z.string().optional(),
  COGNITO_PATIENTS_CLIENT_ID: z.string().optional(),

  // Athena integration — set by ApiStack once the Athena Preview app
  // is provisioned. When empty, AthenaModule boots in disabled mode;
  // every call throws "athena not configured" (safe closed-by-default).
  ATHENA_BASE_URL: z.string().url().optional(),
  ATHENA_TOKEN_URL: z.string().url().optional(),
  ATHENA_CLIENT_ID: z.string().optional(),
  ATHENA_JWK_SECRET_ARN: z.string().optional(),
  ATHENA_DEFAULT_PRACTICE_ID: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(raw: NodeJS.ProcessEnv): AppConfig {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid runtime config:\n${message}`);
  }
  return parsed.data;
}
