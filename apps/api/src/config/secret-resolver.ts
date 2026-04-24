/**
 * Boot-time secret resolver.
 *
 * ECS injects Secret ARNs and Redis endpoint fields as plain env vars
 * (see infra/cdk/lib/api-stack.ts). Before Nest boots we hydrate the
 * vars that the rest of the app expects (DATABASE_URL, REDIS_URL) by
 * calling Secrets Manager directly with the task role's credentials.
 *
 * This runs exactly once, at process start, for both the api service
 * and the one-shot migrate task.
 *
 * Design:
 *  - Idempotent: if DATABASE_URL is already set (local dev / CI),
 *    we skip the fetch.
 *  - Silent on missing ARNs: app still boots and /ready will flag the
 *    affected dep as down (caller sees a clear 503).
 *  - No ARN in logs; only dep names + latency.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface AuroraSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname?: string;
  engine?: string;
}

function region(): string {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
}

function log(msg: string, extra?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      context: 'secret-resolver',
      msg,
      ...(extra ?? {}),
    }),
  );
}

function warn(msg: string, extra?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(
    JSON.stringify({
      level: 'warn',
      context: 'secret-resolver',
      msg,
      ...(extra ?? {}),
    }),
  );
}

async function fetchSecret(arn: string): Promise<string> {
  const client = new SecretsManagerClient({ region: region() });
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) {
    throw new Error('Secret has no SecretString (binary secrets not supported)');
  }
  return res.SecretString;
}

export async function resolveRuntimeSecrets(): Promise<void> {
  const steps: Array<{ name: string; ms: number; status: 'ok' | 'skipped' | 'error' }> = [];

  // --- DATABASE_URL from Aurora secret ---
  if (!process.env.DATABASE_URL && process.env.DB_SECRET_ARN) {
    const started = Date.now();
    try {
      const raw = await fetchSecret(process.env.DB_SECRET_ARN);
      const s = JSON.parse(raw) as AuroraSecret;
      const dbname = s.dbname ?? 'primedhealth';
      const user = encodeURIComponent(s.username);
      const pass = encodeURIComponent(s.password);
      // No `?sslmode=require` in the URL — DbModule sets ssl on the Pool
      // explicitly ({ rejectUnauthorized: false }), which lets Aurora's
      // internal CA bundle work without shipping AWS root certs.
      process.env.DATABASE_URL = `postgres://${user}:${pass}@${s.host}:${s.port}/${dbname}`;
      steps.push({ name: 'database', ms: Date.now() - started, status: 'ok' });
    } catch (err) {
      steps.push({ name: 'database', ms: Date.now() - started, status: 'error' });
      warn('Failed to resolve DB_SECRET_ARN', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  } else if (process.env.DATABASE_URL) {
    steps.push({ name: 'database', ms: 0, status: 'skipped' });
  }

  // --- REDIS_URL from plain env (host/port set by ECS task def) ---
  if (!process.env.REDIS_URL && process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT ?? '6379';
    // ElastiCache with transitEncryption → rediss://
    process.env.REDIS_URL = `rediss://${host}:${port}`;
    steps.push({ name: 'redis', ms: 0, status: 'ok' });
  } else if (process.env.REDIS_URL) {
    steps.push({ name: 'redis', ms: 0, status: 'skipped' });
  }

  log('Runtime secrets resolved', { steps });
}
