/**
 * DbModule — exposes a Drizzle client (`DB_CLIENT`) to the rest of the app.
 *
 * Connection string comes from `DATABASE_URL` (set via Secrets Manager
 * in ECS task def). SSL is enforced unless `DATABASE_SSL=false`, which
 * only applies locally against a plain container.
 */
import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AppConfig } from '../config/config.module';
import * as schema from './schema';

export const DB_CLIENT = Symbol('DB_CLIENT');
export type PrimedDb = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const url = config.get('DATABASE_URL', { infer: true });
        if (!url) {
          // In dev without DATABASE_URL, return a lazy placeholder so the
          // app can still start and serve /health for Fargate health checks.
          const notConfigured = () => {
            throw new Error('DATABASE_URL is not configured');
          };
          return {
            execute: notConfigured,
            query: notConfigured,
            select: notConfigured,
            insert: notConfigured,
            update: notConfigured,
            delete: notConfigured,
          } as unknown as PrimedDb;
        }
        const pool = new Pool({
          connectionString: url,
          ssl:
            process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 30_000,
        });
        return drizzle(pool, { schema, casing: 'snake_case' });
      },
    },
  ],
  exports: [DB_CLIENT],
})
export class DbModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    // Pool lifecycle is tied to the process; Fargate stop signals terminate
    // this cleanly. Explicit pool.end() would require exposing the pool.
  }
}
