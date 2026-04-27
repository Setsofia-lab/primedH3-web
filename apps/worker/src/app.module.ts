import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AgentsModule } from './agents/agents.module';
import { BedrockModule } from './bedrock/bedrock.module';
import { DbModule } from './db/db.module';
import { McpModule } from './mcp/mcp.module';
import { ObservabilityModule } from './observability/observability.module';
import { SqsModule } from './sqs/sqs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ObservabilityModule,
    DbModule,
    BedrockModule,
    McpModule,
    AgentsModule,
    SqsModule,
  ],
})
export class AppModule {}
