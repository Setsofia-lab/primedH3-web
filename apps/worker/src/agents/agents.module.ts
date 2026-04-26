import { Module } from '@nestjs/common';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { IntakeOrchestratorAgent } from './intake-orchestrator.agent';
import { PromptRegistryService } from './prompt-registry.service';
import { ReadinessAgent } from './readiness.agent';
import { RiskScreeningAgent } from './risk-screening.agent';

@Module({
  providers: [
    IntakeOrchestratorAgent,
    RiskScreeningAgent,
    ReadinessAgent,
    AgentDispatcherService,
    PromptRegistryService,
  ],
  exports: [AgentDispatcherService],
})
export class AgentsModule {}
