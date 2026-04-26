/**
 * Worker entrypoint — Phase 3.
 *
 * No HTTP server: this process exists to long-poll SQS and dispatch
 * agent runs. We boot Nest in standalone mode + register graceful
 * shutdown hooks so SIGTERM (ECS deployment cycle) drains the
 * in-flight batch before exiting.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const logger = app.get(Logger);
  logger.log('PrimedHealth worker booted — polling SQS');

  // Keep the process alive forever; SqsPollerService drives the loop.
  await new Promise<void>(() => undefined);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start worker:', err);
  process.exit(1);
});
