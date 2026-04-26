import { Module } from '@nestjs/common';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { IntakeOrchestratorAgent } from './intake-orchestrator.agent';
import { PromptRegistryService } from './prompt-registry.service';

@Module({
  providers: [IntakeOrchestratorAgent, AgentDispatcherService, PromptRegistryService],
  exports: [AgentDispatcherService],
})
export class AgentsModule {}
