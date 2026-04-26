/**
 * DB migration runner.
 *
 * Run as a one-shot ECS task before rolling out new api versions:
 *   `aws ecs run-task --task-definition primedhealth-dev-migrate ...`
 *
 * Locally:
 *   DATABASE_URL=postgres://... pnpm --filter @primedhealth/api migrate:run
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { resolveRuntimeSecrets } from '../config/secret-resolver';
import { seedAgents } from './seed-agents';

async function main(): Promise<void> {
  await resolveRuntimeSecrets();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const db = drizzle(client);
  // eslint-disable-next-line no-console
  console.log('[migrate] running migrations…');
  await migrate(db, { migrationsFolder: `${__dirname}/migrations` });
  // eslint-disable-next-line no-console
  console.log('[migrate] done');

  // eslint-disable-next-line no-console
  console.log('[migrate] seeding agent registry…');
  const n = await seedAgents(db);
  // eslint-disable-next-line no-console
  console.log(`[migrate] upserted ${n} agents`);

  await client.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err);
  process.exit(1);
});
