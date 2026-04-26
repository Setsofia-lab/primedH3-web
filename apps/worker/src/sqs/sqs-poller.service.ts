/**
 * SqsPollerService — long-poll loop that feeds AgentDispatcherService.
 *
 * Strategy: a single in-process loop with `WaitTimeSeconds=20`,
 * `MaxNumberOfMessages=5`. Each message is processed serially; if the
 * dispatcher throws (transient error), we leave the message on the
 * queue so SQS retries via visibility timeout, and DLQ takes it
 * after `maxReceiveCount` attempts (set in DataStack).
 *
 * Successful + permanent-failure messages are deleted explicitly.
 * (`Permanent failure` = bad schema, unknown agent — re-trying the
 * exact same message will never succeed, so we delete and let the
 * agent_runs row record the failure.)
 *
 * Lifecycle: starts on app `onApplicationBootstrap`, stops on
 * `onApplicationShutdown`. Graceful shutdown waits for the in-flight
 * batch to finish before exiting.
 */
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

import { AgentDispatcherService } from '../agents/agent-dispatcher.service';

@Injectable()
export class SqsPollerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SqsPollerService.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private running = false;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatcher: AgentDispatcherService,
  ) {
    const region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';
    this.client = new SQSClient({ region });
    const url = this.config.get<string>('AGENT_QUEUE_URL');
    if (!url) {
      throw new Error('AGENT_QUEUE_URL missing — required for the worker');
    }
    this.queueUrl = url;
  }

  onApplicationBootstrap(): void {
    this.running = true;
    void this.loop();
    this.logger.log(`polling ${this.queueUrl}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    if (this.inFlight) {
      await this.inFlight.catch(() => undefined);
    }
    this.logger.log('poller stopped');
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const res = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 5,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 60,
          }),
        );
        const messages = res.Messages ?? [];
        if (messages.length === 0) continue;

        // Process serially. The volume here is low (one per case-create
        // event for now); concurrency comes when we have multiple agent
        // kinds firing at once.
        this.inFlight = (async () => {
          for (const m of messages) {
            const body = m.Body ?? '';
            const handle = m.ReceiptHandle;
            try {
              await this.dispatcher.handle(body);
              if (handle) {
                await this.client.send(
                  new DeleteMessageCommand({
                    QueueUrl: this.queueUrl,
                    ReceiptHandle: handle,
                  }),
                );
              }
            } catch (err) {
              this.logger.error(
                `dispatcher threw on message ${m.MessageId}: ${(err as Error).message}`,
              );
              // Don't delete — let SQS retry. After maxReceiveCount, DLQ.
            }
          }
        })();
        await this.inFlight;
        this.inFlight = null;
      } catch (err) {
        // Network blip etc. — wait a beat and retry.
        this.logger.error(`receive failed: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }
}
