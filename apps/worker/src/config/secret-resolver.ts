/**
 * Boot-time secret resolver for the worker.
 *
 * ECS injects DB_SECRET_ARN + REDIS_HOST/PORT as plain env vars
 * (see infra/cdk/lib/agent-stack.ts). Before Nest boots we hydrate
 * DATABASE_URL by pulling the Aurora secret with the task role.
 *
 * Mirrors apps/api/src/config/secret-resolver.ts so the worker follows
 * the same env contract as the api.
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
  console.log(JSON.stringify({ level: 'info', context: 'worker-secret-resolver', msg, ...(extra ?? {}) }));
}

function warn(msg: string, extra?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({ level: 'warn', context: 'worker-secret-resolver', msg, ...(extra ?? {}) }));
}

async function fetchSecret(arn: string): Promise<string> {
  const client = new SecretsManagerClient({ region: region() });
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) throw new Error('Secret has no SecretString');
  return res.SecretString;
}

export async function resolveRuntimeSecrets(): Promise<void> {
  const steps: Array<{ name: string; ms: number; status: 'ok' | 'skipped' | 'error' }> = [];

  if (!process.env.DATABASE_URL && process.env.DB_SECRET_ARN) {
    const started = Date.now();
    try {
      const raw = await fetchSecret(process.env.DB_SECRET_ARN);
      const s = JSON.parse(raw) as AuroraSecret;
      const dbname = s.dbname ?? 'primedhealth';
      const user = encodeURIComponent(s.username);
      const pass = encodeURIComponent(s.password);
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

  if (!process.env.REDIS_URL && process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT ?? '6379';
    process.env.REDIS_URL = `rediss://${host}:${port}`;
    steps.push({ name: 'redis', ms: 0, status: 'ok' });
  } else if (process.env.REDIS_URL) {
    steps.push({ name: 'redis', ms: 0, status: 'skipped' });
  }

  // LangSmith API key — optional. When LANGSMITH_API_KEY_ARN is set,
  // pull the raw secret string into LANGSMITH_API_KEY. The tracer is a
  // no-op if neither is present after this resolver runs.
  if (!process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_API_KEY_ARN) {
    const started = Date.now();
    try {
      const raw = await fetchSecret(process.env.LANGSMITH_API_KEY_ARN);
      // Stored as either a raw key string or a {key:"..."} JSON object.
      let key = raw.trim();
      try {
        const parsed = JSON.parse(raw) as { key?: string; api_key?: string };
        key = parsed.key ?? parsed.api_key ?? key;
      } catch {
        // not JSON — use the raw string
      }
      if (key) process.env.LANGSMITH_API_KEY = key;
      steps.push({ name: 'langsmith', ms: Date.now() - started, status: 'ok' });
    } catch (err) {
      steps.push({ name: 'langsmith', ms: Date.now() - started, status: 'error' });
      warn('Failed to resolve LANGSMITH_API_KEY_ARN (tracing will be disabled)', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  } else if (process.env.LANGSMITH_API_KEY) {
    steps.push({ name: 'langsmith', ms: 0, status: 'skipped' });
  }

  log('Runtime secrets resolved', { steps });
}
