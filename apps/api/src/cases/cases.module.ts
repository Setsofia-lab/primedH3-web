import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { PatientsSelfController } from './patients-self.controller';
import { ProvidersSelfController } from './providers-self.controller';

@Module({
  controllers: [CasesController, PatientsSelfController, ProvidersSelfController],
})
export class CasesModule {}
