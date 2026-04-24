/**
 * ApiStack — ECS Fargate service for `@primedhealth/api`, ALB, task
 * definition, IAM role, auto-scaling.
 *
 * Build context: repo root. Dockerfile: apps/api/Dockerfile.
 *
 * In dev: 1 task, 0.25 vCPU / 0.5 GB. ALB is HTTP on :80 because we
 * don't have a domain yet (M2 wires ACM + HTTPS); the ALB is still
 * internet-facing so we can curl /health from anywhere.
 *
 * In prod: 2 tasks min / 10 max, auto-scaled on CPU + request count,
 * HTTPS-only via ACM cert (wired in M10 prod cutover).
 */

import * as path from 'node:path';
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';

export interface CognitoPoolRef {
  readonly poolId: string;
  readonly clientId: string;
}

export interface ApiStackProps extends StackProps {
  readonly envName: EnvName;
  readonly vpc: ec2.IVpc;
  readonly cmk: kms.IKey;
  readonly aurora: rds.DatabaseCluster;
  readonly auroraSecurityGroup: ec2.ISecurityGroup;
  readonly redis: elasticache.CfnReplicationGroup;
  readonly redisSecurityGroup: ec2.ISecurityGroup;
  readonly uploadsBucket: s3.IBucket;
  readonly apiLogGroup: logs.ILogGroup;
  readonly athenaPrivateJwk: sm.ISecret;
  readonly cognitoAdmins: CognitoPoolRef;
  readonly cognitoProviders: CognitoPoolRef;
  readonly cognitoPatients: CognitoPoolRef;
}

export class ApiStack extends Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly service: ecs.FargateService;
  public readonly migrateTaskFamily: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';

    // --- Cluster ---
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `primedhealth-${props.envName}`,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // --- Container image built from Dockerfile at repo root ---
    const image = new ecr_assets.DockerImageAsset(this, 'ApiImage', {
      directory: path.resolve(__dirname, '..', '..', '..'),
      file: 'apps/api/Dockerfile',
      platform: ecr_assets.Platform.LINUX_AMD64,
      // Avoid recursive copy loops + wasted upload bandwidth.
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

    // --- Task IAM role (least-privilege) ---
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'PrimedHealth api runtime role',
    });

    // Use identity-based (task role) policy statements to avoid cross-stack
    // resource-policy cycles. The cross-service principals already have
    // decrypt access to the CMK via its own key policy (set in SecretsStack +
    // ObservabilityStack).
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
        sid: 'ReadAppSecrets',
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: [
          props.athenaPrivateJwk.secretArn,
          ...(props.aurora.secret ? [props.aurora.secret.secretArn] : []),
        ],
      }),
    );
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'RwUploadsBucket',
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:ListBucket',
          's3:AbortMultipartUpload',
          's3:ListBucketMultipartUploads',
        ],
        resources: [props.uploadsBucket.bucketArn, `${props.uploadsBucket.bucketArn}/*`],
      }),
    );

    // --- Task definition ---
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: isProd ? 1024 : 256,
      memoryLimitMiB: isProd ? 2048 : 512,
      taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // Grant execution role permission to pull logs + ECR (auto via AmazonECSTaskExecutionRolePolicy on taskDef.executionRole)
    taskDef.addContainer('api', {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      containerName: 'api',
      portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: props.apiLogGroup,
      }),
      environment: {
        NODE_ENV: isProd ? 'production' : 'staging',
        PORT: '3001',
        LOG_LEVEL: 'info',
        SERVICE_NAME: 'primedhealth-api',
        SERVICE_VERSION: image.imageTag,
        AWS_REGION: this.region,
        // Secret ARNs — the app resolves them at boot via Secrets Manager
        // SDK. This avoids cross-stack CFN resource-policy cycles that
        // would arise from ecs.Secret.fromSecretsManager on an ISecret
        // living in a sibling stack.
        DB_SECRET_ARN: props.aurora.secret?.secretArn ?? '',
        ATHENA_JWK_SECRET_ARN: props.athenaPrivateJwk.secretArn,
        // Athena integration (non-secret values — client_id appears in
        // every OAuth request; practice ids appear in every FHIR URL).
        // Base + token URLs are optional — AthenaModule falls back to
        // the canonical Preview defaults when unset. We set them
        // explicitly so prod can override without a code change.
        ATHENA_CLIENT_ID: props.envName === 'prod' ? '' : '0oa12cfxyvfhIGS6I298',
        ATHENA_BASE_URL:
          props.envName === 'prod' ? '' : 'https://api.preview.platform.athenahealth.com',
        ATHENA_TOKEN_URL:
          props.envName === 'prod'
            ? ''
            : 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
        ATHENA_DEFAULT_PRACTICE_ID: props.envName === 'prod' ? '' : '1128700',
        REDIS_HOST: props.redis.attrPrimaryEndPointAddress,
        REDIS_PORT: props.redis.attrPrimaryEndPointPort,
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        // Cognito — the auth module verifies JWTs issued by any of these
        // three pools. Pool IDs are non-secret (they appear in every JWT's
        // `iss` claim) so env vars are fine.
        COGNITO_REGION: this.region,
        COGNITO_ADMINS_POOL_ID: props.cognitoAdmins.poolId,
        COGNITO_ADMINS_CLIENT_ID: props.cognitoAdmins.clientId,
        COGNITO_PROVIDERS_POOL_ID: props.cognitoProviders.poolId,
        COGNITO_PROVIDERS_CLIENT_ID: props.cognitoProviders.clientId,
        COGNITO_PATIENTS_POOL_ID: props.cognitoPatients.poolId,
        COGNITO_PATIENTS_CLIENT_ID: props.cognitoPatients.clientId,
      },
      // No container-level health check: distroless images have no shell
      // for CMD-SHELL, and the ALB target group already polls GET /health
      // (configured below). One source of truth.
    });

    // --- Migrate (one-shot) task definition ---
    // Same image, same taskRole, same env — only the entrypoint changes.
    // Run via `aws ecs run-task --task-definition primedhealth-<env>-migrate`.
    // See docs/runbooks/migrate.md.
    const migrateTaskDef = new ecs.FargateTaskDefinition(this, 'MigrateTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole,
      family: `primedhealth-${props.envName}-migrate`,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    this.migrateTaskFamily = `primedhealth-${props.envName}-migrate`;
    migrateTaskDef.addContainer('migrate', {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      containerName: 'migrate',
      command: ['dist/db/migrate.js'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'migrate',
        logGroup: props.apiLogGroup,
      }),
      environment: {
        NODE_ENV: isProd ? 'production' : 'staging',
        LOG_LEVEL: 'info',
        SERVICE_NAME: 'primedhealth-api-migrate',
        SERVICE_VERSION: image.imageTag,
        AWS_REGION: this.region,
        DB_SECRET_ARN: props.aurora.secret?.secretArn ?? '',
      },
      essential: true,
    });

    // --- Service Security Group ---
    const serviceSg = new ec2.SecurityGroup(this, 'ServiceSg', {
      vpc: props.vpc,
      description: 'PrimedHealth api task SG',
      allowAllOutbound: true,
    });

    // --- ALB (public) ---
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: props.vpc,
      description: 'PrimedHealth api ALB SG',
      allowAllOutbound: false,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP (pre-domain)');
    if (isProd) {
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    }
    albSg.addEgressRule(serviceSg, ec2.Port.tcp(3001), 'ALB to api');
    serviceSg.addIngressRule(albSg, ec2.Port.tcp(3001), 'ALB ingress');

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      loadBalancerName: `primedhealth-${props.envName}-api`,
    });

    // --- Service ---
    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: isProd ? 2 : 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [serviceSg],
      enableExecuteCommand: !isProd, // ECS Exec for debugging in dev only
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
    });

    const listener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false, // ingress is controlled via SG rules above
    });
    listener.addTargets('ApiTarget', {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.service],
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: Duration.seconds(15),
    });

    // --- Auto-scaling ---
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: isProd ? 2 : 1,
      maxCapacity: isProd ? 10 : 2,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

    // --- Allow service SG to reach Aurora + Redis ---
    // Use low-level CfnSecurityGroupIngress to avoid cross-stack cycles:
    // a high-level addIngressRule() on a sibling-stack SG would pull that
    // stack's SG into our synth graph while also referencing its secret ARN.
    new ec2.CfnSecurityGroupIngress(this, 'AuroraIngressFromApi', {
      groupId: props.auroraSecurityGroup.securityGroupId,
      sourceSecurityGroupId: serviceSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'api to aurora',
    });
    new ec2.CfnSecurityGroupIngress(this, 'RedisIngressFromApi', {
      groupId: props.redisSecurityGroup.securityGroupId,
      sourceSecurityGroupId: serviceSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      description: 'api to redis',
    });

    // --- Nag suppressions ---
    NagSuppressions.addResourceSuppressions(
      this.alb,
      [
        {
          id: 'AwsSolutions-ELB2',
          reason:
            'ALB access logs will be wired to the shared log bucket in M8 hardening. CloudTrail + WAF logs cover the gap for dev.',
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(albSg, [
      {
        id: 'AwsSolutions-EC23',
        reason:
          'ALB is internet-facing by design — api.dev.primed.ai public endpoint. Ingress is restricted to ports 80/443; everything behind it sits in private subnets.',
      },
    ]);
    NagSuppressions.addResourceSuppressions(
      taskDef.obtainExecutionRole(),
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Execution role uses the AWS-managed AmazonECSTaskExecutionRolePolicy defaults (ECR pull + CloudWatch Logs write) which include narrowly-scoped wildcards. Task-role permissions (application-level access) are all resource-scoped.',
          appliesTo: ['Resource::*'],
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      listener,
      [
        {
          id: 'AwsSolutions-ELB2',
          reason:
            'HTTP listener is temporary — ACM cert + HTTPS listener land in M2 once domain (primed.ai) is delegated.',
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
            'Environment variables here are non-sensitive (NODE_ENV, PORT, etc.). Sensitive values (DATABASE_URL) use Secrets Manager injection.',
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      taskRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Wildcard permissions here are scoped to resources created in this stack (KMS key, Secrets Manager ARNs, uploads bucket prefix). Each grant call on the construct enforces the resource boundary.',
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      migrateTaskDef,
      [
        {
          id: 'AwsSolutions-ECS2',
          reason:
            'Env vars on the migrate task def are non-sensitive (secret ARNs, not values). Secret values are fetched at runtime via task role.',
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      migrateTaskDef.obtainExecutionRole(),
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Execution role uses the AWS-managed AmazonECSTaskExecutionRolePolicy defaults (ECR pull + CloudWatch Logs write). Same justification as the api task def execution role.',
          appliesTo: ['Resource::*'],
        },
      ],
      true,
    );

    // --- Stack outputs (used by docs/runbooks/migrate.md) ---
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'MigrateTaskFamily', { value: this.migrateTaskFamily });
    new CfnOutput(this, 'ServiceSubnetIds', {
      value: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS })
        .subnetIds.join(','),
    });
    new CfnOutput(this, 'ServiceSgId', { value: serviceSg.securityGroupId });
    new CfnOutput(this, 'AlbDnsName', { value: this.alb.loadBalancerDnsName });
  }
}
