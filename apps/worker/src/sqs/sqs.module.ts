import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { SqsPollerService } from './sqs-poller.service';

@Module({
  imports: [AgentsModule],
  providers: [SqsPollerService],
})
export class SqsModule {}
