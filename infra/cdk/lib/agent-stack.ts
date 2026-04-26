/**
 * AgentStack — ECS Fargate service for the agent worker (Phase 3, M11).
 *
 * Long-polls the SQS agent queue, calls Bedrock per agent kind, writes
 * to the same Aurora cluster as the api. No ALB — the worker is a
 * SQS consumer with no inbound traffic.
 *
 * In dev: 1 task at 0.25 vCPU / 0.5 GB.
 * In prod: 2 tasks (HA), auto-scale on queue depth in M16 (eval +
 * rollout milestone).
 */
import * as path from 'node:path';
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';

export interface AgentStackProps extends StackProps {
  readonly envName: EnvName;
  readonly vpc: ec2.IVpc;
  readonly cmk: kms.IKey;
  readonly aurora: rds.DatabaseCluster;
  readonly auroraSecurityGroup: ec2.ISecurityGroup;
  readonly redis: elasticache.CfnReplicationGroup;
  readonly redisSecurityGroup: ec2.ISecurityGroup;
  readonly agentQueue: sqs.IQueue;
  readonly agentDlq: sqs.IQueue;
  /** Re-use the api log group so /aws/ecs/<env>/api streams contain
   *  both api and worker — easier to grep correlation ids across. */
  readonly apiLogGroup: logs.ILogGroup;
}

export class AgentStack extends Stack {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';

    const cluster = ecs.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
      clusterName: `primedhealth-${props.envName}`,
      vpc: props.vpc,
      securityGroups: [],
    });

    // Build context = repo root, Dockerfile = apps/worker/Dockerfile.
    const image = new ecr_assets.DockerImageAsset(this, 'WorkerImage', {
      directory: path.resolve(__dirname, '..', '..', '..'),
      file: 'apps/worker/Dockerfile',
      platform: ecr_assets.Platform.LINUX_AMD64,
      exclude: [
        'node_modules',
        '**/node_modules',
        'infra/cdk/cdk.out',
        'apps/web/.next',
        'apps/web/storybook-static',
        'apps/web/test-results',
        '**/dist',
        '**/.next',
        '**/coverage',
        '.git',
        '.github',
        '.vercel',
      ],
    });

    // Task IAM role.
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'PrimedHealth agent-worker runtime role',
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'UseAppCmk',
        actions: [
          'kms:Encrypt',
          'kms:Decrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:DescribeKey',
        ],
        resources: [props.cmk.keyArn],
      }),
    );
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadDbSecret',
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: props.aurora.secret ? [props.aurora.secret.secretArn] : [],
      }),
    );
    // SQS — receive + delete on the agent queue (worker reads). The
    // api side gets a separate grant on the queue from ApiStack.
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ConsumeAgentQueue',
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
          'sqs:GetQueueUrl',
          'sqs:ChangeMessageVisibility',
        ],
        resources: [props.agentQueue.queueArn, props.agentDlq.queueArn],
      }),
    );
    // Bedrock — InvokeModel on Anthropic Claude models. Wildcard model
    // arn (per-model arns differ per-region and Anthropic version
    // bumps).
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'InvokeBedrockClaude',
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-*`,
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        ],
      }),
    );

    // Security group: outbound only.
    const workerSg = new ec2.SecurityGroup(this, 'WorkerSg', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Agent worker - outbound only (SQS, Bedrock, Aurora, Redis)',
    });
    // Use low-level CfnSecurityGroupIngress (same pattern as ApiStack)
    // so we don't pull DataStack's SG into our synth graph and create a
    // cycle.
    new ec2.CfnSecurityGroupIngress(this, 'AuroraIngressFromWorker', {
      groupId: props.auroraSecurityGroup.securityGroupId,
      sourceSecurityGroupId: workerSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'agent worker to aurora',
    });
    new ec2.CfnSecurityGroupIngress(this, 'RedisIngressFromWorker', {
      groupId: props.redisSecurityGroup.securityGroupId,
      sourceSecurityGroupId: workerSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      description: 'agent worker to redis',
    });

    // Task definition.
    const taskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole,
    });

    const container = taskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      containerName: 'worker',
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'worker',
        logGroup: props.apiLogGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        AWS_REGION: this.region,
        AGENT_QUEUE_URL: props.agentQueue.queueUrl,
        DB_SECRET_ARN: props.aurora.secret?.secretArn ?? '',
        REDIS_HOST: props.redis.attrPrimaryEndPointAddress,
        REDIS_PORT: props.redis.attrPrimaryEndPointPort,
        // Stub mode default-on until the operator enables Bedrock
        // model access in the AWS console (one-time per account).
        // Flip to 0 in prod once access is granted.
        AWS_BEDROCK_DISABLED: isProd ? '0' : '1',
      },
      // Suppress the container-level health check: distroless has no
      // shell, and the worker has no HTTP listener anyway. Liveness is
      // implicit — if the process exits, ECS restarts the task.
    });

    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: isProd ? 2 : 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [workerSg],
      circuitBreaker: { rollback: true },
      enableExecuteCommand: false,
      minHealthyPercent: 0,
    });

    new CfnOutput(this, 'WorkerServiceArn', { value: this.service.serviceArn });

    // ----- cdk-nag suppressions -----

    NagSuppressions.addResourceSuppressions(
      taskRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Bedrock InvokeModel needs a wildcard on anthropic.claude-* because ' +
            'Anthropic adds new model versions monthly; pinning would block ' +
            'rolling forward without a CDK redeploy. Inference-profile ARN is ' +
            'also wildcard for the same reason — profiles are created per env. ' +
            'KMS data-key wildcards are scoped to the app CMK only.',
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      taskDef,
      [
        {
          id: 'AwsSolutions-ECS2',
          reason:
            'Plaintext env vars are non-secret routing config (queue URL, ' +
            'redis host/port, region, AWS_BEDROCK_DISABLED toggle). The DB ' +
            'password lives behind DB_SECRET_ARN which the worker resolves ' +
            'at startup via Secrets Manager, never as a plaintext env.',
        },
      ],
      true,
    );

    // Execution role wildcards come from the default ECR pull + log-stream
    // grants CDK adds; they're already scoped via service principal.
    NagSuppressions.addResourceSuppressions(
      taskDef.executionRole!,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'CDK-managed execution role pulls the worker image from ECR + ' +
            'writes to the shared CloudWatch log group. Wildcards are on ' +
            'log streams under the specific log group only.',
        },
      ],
      true,
    );

    void Duration.minutes(0); // keep import alive for future scaling helpers
  }
}
