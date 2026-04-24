import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { loadConfig, type AppConfig } from './config.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Validate — not just parse — the raw env.
      validate: (raw: Record<string, unknown>) =>
        loadConfig(raw as NodeJS.ProcessEnv) as unknown as Record<string, unknown>,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

export type { AppConfig };
