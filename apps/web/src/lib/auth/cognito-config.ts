/**
 * Cognito configuration resolved from env.
 *
 * Populated at build time by Vercel (see .env / Vercel dashboard env vars).
 * Missing values → `NEXT_PUBLIC_DEV_AUTH=1` must be set, otherwise
 * auth routes refuse to issue redirects.
 */
import type { Pool } from '@/types/session';

export interface PoolConfig {
  readonly poolId: string;
  readonly clientId: string;
  readonly domain: string; // e.g. primedhealth-dev-admins.auth.us-east-1.amazoncognito.com
}

export interface CognitoConfig {
  readonly region: string;
  readonly admins: PoolConfig;
  readonly providers: PoolConfig;
  readonly patients: PoolConfig;
}

/** Returns null when auth env is incomplete (dev-auth mode). */
export function getCognitoConfig(): CognitoConfig | null {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const admins = poolFromEnv('ADMINS');
  const providers = poolFromEnv('PROVIDERS');
  const patients = poolFromEnv('PATIENTS');
  if (!region || !admins || !providers || !patients) return null;
  return { region, admins, providers, patients };
}

function poolFromEnv(prefix: 'ADMINS' | 'PROVIDERS' | 'PATIENTS'): PoolConfig | null {
  const poolId = process.env[`NEXT_PUBLIC_COGNITO_${prefix}_POOL_ID`];
  const clientId = process.env[`NEXT_PUBLIC_COGNITO_${prefix}_CLIENT_ID`];
  const domain = process.env[`NEXT_PUBLIC_COGNITO_${prefix}_DOMAIN`];
  if (!poolId || !clientId || !domain) return null;
  return { poolId, clientId, domain };
}

export function poolConfig(cfg: CognitoConfig, pool: Pool): PoolConfig {
  return pool === 'admins' ? cfg.admins : pool === 'providers' ? cfg.providers : cfg.patients;
}

/** Dev-auth mode bypasses Cognito for local + Vercel preview. */
export function isDevAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_AUTH === '1';
}
