import { Global, Module } from '@nestjs/common';
import { LangSmithTracer } from './langsmith-tracer';

@Global()
@Module({
  providers: [LangSmithTracer],
  exports: [LangSmithTracer],
})
export class ObservabilityModule {}
