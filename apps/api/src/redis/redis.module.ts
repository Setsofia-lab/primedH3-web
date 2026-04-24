import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../config/config.module';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const url = config.get('REDIS_URL', { infer: true });
        // Fall back to a local default so the app can boot in dev even
        // without Redis; readiness will flag it as `down`.
        const client = new Redis(url ?? 'redis://127.0.0.1:6379', {
          // Eager connect so readiness probes get a real state, not
          // "offline queue disabled"; maxRetries bounds reconnect storms.
          lazyConnect: false,
          maxRetriesPerRequest: 2,
          connectTimeout: 3000,
          enableOfflineQueue: true,
          tls: (url ?? '').startsWith('rediss://') ? {} : undefined,
        });
        // Suppress unhandled-error crash — readiness reports status instead.
        client.on('error', () => undefined);
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
