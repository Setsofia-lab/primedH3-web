import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Correlation-id per request so we can follow a call across web → api → agents.
        genReqId: (req, res) => {
          const incoming = (req.headers['x-correlation-id'] as string) || randomUUID();
          res.setHeader('x-correlation-id', incoming);
          return incoming;
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.token',
          ],
          remove: true,
        },
      },
    }),
    TerminusModule,
    DbModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
