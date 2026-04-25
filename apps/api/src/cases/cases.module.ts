import { Global, Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { DocumentsController } from './documents.controller';
import { IntakeOrchestratorService } from './intake-orchestrator.service';
import { MessagesController } from './messages.controller';
import { PatientsSelfController } from './patients-self.controller';
import { ProvidersSelfController } from './providers-self.controller';
import { TasksController } from './tasks.controller';

@Global()
@Module({
  controllers: [
    CasesController,
    PatientsSelfController,
    ProvidersSelfController,
    TasksController,
    MessagesController,
    DocumentsController,
  ],
  providers: [IntakeOrchestratorService],
  exports: [IntakeOrchestratorService],
})
export class CasesModule {}
