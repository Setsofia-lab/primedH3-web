import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { AppConfig } from '../config/config.module';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { REDIS_CLIENT } from '../redis/redis.module';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly health: HealthCheckService,
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * ALB liveness probe. Do not touch deps here — a DB outage should
   * NOT cause ALB to terminate our tasks.
   */
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  healthz() {
    return {
      status: 'ok',
      service: this.config.get('SERVICE_NAME', { infer: true }),
      version: this.config.get('SERVICE_VERSION', { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Kubernetes/ALB readiness probe. Returns 200 only if both Postgres
   * and Redis respond within timeout. Used by the ALB to decide whether
   * to send traffic to this task.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — deps reachable' })
  ready() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        const started = Date.now();
        try {
          await this.db.execute(sql`select 1`);
          return {
            database: {
              status: 'up',
              latencyMs: Date.now() - started,
            },
          };
        } catch (err) {
          return {
            database: {
              status: 'down',
              message: err instanceof Error ? err.message : 'unknown',
            },
          };
        }
      },
      async (): Promise<HealthIndicatorResult> => {
        const started = Date.now();
        try {
          const pong = await this.redis.ping();
          return {
            redis: {
              status: pong === 'PONG' ? 'up' : 'down',
              latencyMs: Date.now() - started,
            },
          };
        } catch (err) {
          return {
            redis: {
              status: 'down',
              message: err instanceof Error ? err.message : 'unknown',
            },
          };
        }
      },
    ]);
  }
}
