import { Module } from '@nestjs/common';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { AnesthesiaClearanceAgent } from './anesthesia-clearance.agent';
import { IntakeOrchestratorAgent } from './intake-orchestrator.agent';
import { PatientCommsAgent } from './patient-comms.agent';
import { PreHabAgent } from './pre-hab.agent';
import { PromptRegistryService } from './prompt-registry.service';
import { ReadinessAgent } from './readiness.agent';
import { ReferralAgent } from './referral.agent';
import { RiskScreeningAgent } from './risk-screening.agent';
import { SchedulingAgent } from './scheduling.agent';

@Module({
  providers: [
    IntakeOrchestratorAgent,
    RiskScreeningAgent,
    AnesthesiaClearanceAgent,
    SchedulingAgent,
    ReferralAgent,
    PatientCommsAgent,
    PreHabAgent,
    ReadinessAgent,
    AgentDispatcherService,
    PromptRegistryService,
  ],
  exports: [AgentDispatcherService],
})
export class AgentsModule {}
