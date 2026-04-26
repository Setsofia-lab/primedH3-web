/**
 * DbModule — Drizzle client wired against Aurora. Same connection
 * shape as the api uses; we keep them in lockstep manually for now
 * rather than extracting to a shared package (the schema lives in
 * apps/api/src/db/schema and the worker imports from there).
 */
import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const DB_CLIENT = Symbol('DB_CLIENT');
export type WorkerDb = NodePgDatabase;

class DbProvider implements OnApplicationShutdown {
  constructor(public readonly pool: Pool) {}
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'DB_PROVIDER',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL missing — required for the worker');
        const pool = new Pool({
          connectionString: url,
          ssl:
            config.get<string>('DATABASE_SSL') === 'false'
              ? false
              : { rejectUnauthorized: false },
          max: 5,
          idleTimeoutMillis: 30_000,
        });
        return new DbProvider(pool);
      },
    },
    {
      provide: DB_CLIENT,
      inject: ['DB_PROVIDER'],
      useFactory: (p: DbProvider) => drizzle(p.pool),
    },
  ],
  exports: [DB_CLIENT],
})
export class DbModule {}
