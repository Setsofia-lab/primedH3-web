/**
 * Athena integration config — resolved from env.
 *
 * - ATHENA_BASE_URL      — API base (Preview vs Production)
 * - ATHENA_TOKEN_URL     — OAuth 2.0 token endpoint (client_assertion flow)
 * - ATHENA_CLIENT_ID     — public client ID from the Athena dev portal
 * - ATHENA_JWK_SECRET_ARN— Secrets Manager ARN for the private JWK (set by ApiStack)
 * - ATHENA_DEFAULT_PRACTICE_ID — the primary practice we're pulling from
 *                                 (Constitution §12: `1128700` for Preview)
 *
 * In local dev / CI without these, `AthenaAuthService` refuses every
 * request with a clear "athena not configured" error so the rest of
 * the app still boots.
 */
import { z } from 'zod';

export const athenaEnvSchema = z.object({
  ATHENA_BASE_URL: z.string().url().optional(),
  ATHENA_TOKEN_URL: z.string().url().optional(),
  ATHENA_CLIENT_ID: z.string().optional(),
  ATHENA_JWK_SECRET_ARN: z.string().optional(),
  ATHENA_DEFAULT_PRACTICE_ID: z.string().optional(),
});

export type AthenaEnv = z.infer<typeof athenaEnvSchema>;

/**
 * Canonical defaults for Athena Preview.
 * These are the Athenahealth documented endpoints for the sandbox; if
 * the user's dev portal "Documentation site" surface says different,
 * override via env.
 */
export const ATHENA_PREVIEW_DEFAULTS = {
  baseUrl: 'https://api.preview.platform.athenahealth.com',
  tokenUrl: 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
  fhirPath: '/fhir/r4',
  athenaOnePath: '/v1',
  defaultPracticeId: '1128700', // Constitution §12 locked decision
} as const;

export interface AthenaResolvedConfig {
  readonly baseUrl: string;
  readonly tokenUrl: string;
  readonly fhirBaseUrl: string;
  readonly athenaOneBaseUrl: string;
  readonly clientId: string;
  readonly jwkSecretArn: string;
  readonly defaultPracticeId: string;
}

export function resolveAthenaConfig(env: AthenaEnv): AthenaResolvedConfig | null {
  const clientId = env.ATHENA_CLIENT_ID;
  const jwkSecretArn = env.ATHENA_JWK_SECRET_ARN;
  if (!clientId || !jwkSecretArn) return null;

  const baseUrl = env.ATHENA_BASE_URL ?? ATHENA_PREVIEW_DEFAULTS.baseUrl;
  const tokenUrl = env.ATHENA_TOKEN_URL ?? ATHENA_PREVIEW_DEFAULTS.tokenUrl;
  return {
    baseUrl,
    tokenUrl,
    fhirBaseUrl: `${baseUrl}${ATHENA_PREVIEW_DEFAULTS.fhirPath}`,
    athenaOneBaseUrl: `${baseUrl}${ATHENA_PREVIEW_DEFAULTS.athenaOnePath}`,
    clientId,
    jwkSecretArn,
    defaultPracticeId: env.ATHENA_DEFAULT_PRACTICE_ID ?? ATHENA_PREVIEW_DEFAULTS.defaultPracticeId,
  };
}
