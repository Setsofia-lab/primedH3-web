import { Module } from '@nestjs/common';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { IntakeOrchestratorAgent } from './intake-orchestrator.agent';

@Module({
  providers: [IntakeOrchestratorAgent, AgentDispatcherService],
  exports: [AgentDispatcherService],
})
export class AgentsModule {}
