import { Global, Module } from '@nestjs/common';
import { AgentDispatcherService } from './agent-dispatcher.service';

@Global()
@Module({
  providers: [AgentDispatcherService],
  exports: [AgentDispatcherService],
})
export class AgentsModule {}
