/**
 * DataStack — Aurora Serverless v2 (Postgres), ElastiCache Redis,
 * S3 uploads bucket, SQS agent queue + DLQ.
 *
 * Dev sizing:
 *  - Aurora: scale-to-0 enabled (0–1 ACU), single writer, no reader.
 *  - Redis: cache.t4g.micro, single node, no failover.
 *  - S3: versioned, SSE-KMS with our CMK, public access blocked.
 *  - SQS: main queue + DLQ with 3-attempt redrive.
 *
 * Prod sizing (applied via `envName === 'prod'`):
 *  - Aurora: 0.5–4 ACU, 1 writer + 1 reader in different AZ, backup
 *    retention 30 days, deletion protection.
 *  - Redis: cache.m7g.large, 1 replica, multi-AZ failover.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';

export interface DataStackProps extends StackProps {
  readonly envName: EnvName;
  readonly vpc: ec2.IVpc;
  readonly cmk: kms.IKey;
}

export class DataStack extends Stack {
  public readonly aurora: rds.DatabaseCluster;
  public readonly auroraSecurityGroup: ec2.SecurityGroup;
  public readonly redis: elasticache.CfnReplicationGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;
  public readonly uploadsBucket: s3.Bucket;
  public readonly agentQueue: sqs.Queue;
  public readonly agentDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';
    const destroyPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // ----- Aurora Serverless v2 -----
    const auroraSg = new ec2.SecurityGroup(this, 'AuroraSg', {
      vpc: props.vpc,
      description: 'Aurora Postgres - app-layer access only',
      allowAllOutbound: false,
    });
    this.auroraSecurityGroup = auroraSg;

    this.aurora = new rds.DatabaseCluster(this, 'Aurora', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('primed_admin', {
        secretName: `/primedhealth/${props.envName}/db/master`,
        encryptionKey: props.cmk,
      }),
      defaultDatabaseName: 'primedhealth',
      writer: rds.ClusterInstance.serverlessV2('writer', {
        autoMinorVersionUpgrade: true,
      }),
      readers: isProd
        ? [rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true })]
        : [],
      serverlessV2MinCapacity: isProd ? 0.5 : 0,
      serverlessV2MaxCapacity: isProd ? 4 : 1,
      storageEncrypted: true,
      storageEncryptionKey: props.cmk,
      backup: {
        retention: isProd ? Duration.days(30) : Duration.days(1),
      },
      deletionProtection: isProd,
      removalPolicy: destroyPolicy,
      securityGroups: [auroraSg],
      iamAuthentication: true,
    });

    // ----- ElastiCache Redis -----
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: props.vpc,
      description: 'Redis - app-layer access only',
      allowAllOutbound: false,
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Private-isolated subnets for Redis',
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: `primedhealth-${props.envName}-redis`,
    });

    this.redis = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: `PrimedHealth ${props.envName} Redis`,
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: isProd ? 'cache.m7g.large' : 'cache.t4g.micro',
      numCacheClusters: isProd ? 2 : 1,
      automaticFailoverEnabled: isProd,
      multiAzEnabled: isProd,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      kmsKeyId: props.cmk.keyArn,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [this.redisSecurityGroup.securityGroupId],
      snapshotRetentionLimit: isProd ? 7 : 1,
    });
    this.redis.addDependency(redisSubnetGroup);

    // ----- S3 uploads bucket -----
    this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `primedhealth-${props.envName}-uploads-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.cmk,
      bucketKeyEnabled: true,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(7),
          noncurrentVersionExpiration: isProd ? Duration.days(365) : Duration.days(30),
        },
      ],
      removalPolicy: destroyPolicy,
      autoDeleteObjects: !isProd,
      // CORS so browsers on the web app can PUT directly to S3 via
      // presigned URLs (M7.8 documents). The bucket stays private —
      // CORS only governs cross-origin browser requests; presign is the
      // gate.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: isProd
            ? ['https://app.primed.ai', 'https://staging.primed.ai']
            : [
                'http://localhost:3000',
                'https://primedh3-web.vercel.app',
                'https://staging.primed.ai',
              ],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      // Server access logs land in a dedicated log bucket in M8. For now
      // CloudTrail + VPC Flow Logs cover the audit need.
    });

    // ----- SQS agent queue + DLQ -----
    this.agentDlq = new sqs.Queue(this, 'AgentDlq', {
      queueName: `primedhealth-${props.envName}-agent-dlq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.cmk,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.agentQueue = new sqs.Queue(this, 'AgentQueue', {
      queueName: `primedhealth-${props.envName}-agent-queue`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.cmk,
      visibilityTimeout: Duration.minutes(5),
      retentionPeriod: Duration.days(4),
      enforceSSL: true,
      deadLetterQueue: { queue: this.agentDlq, maxReceiveCount: 3 },
    });

    // Nag suppressions — narrow, justified.
    NagSuppressions.addResourceSuppressions(
      this.aurora,
      [
        {
          id: 'AwsSolutions-RDS10',
          reason:
            'Deletion protection is env-gated via `deletionProtection: isProd`. Dev is intentionally nuke-able.',
        },
        {
          id: 'AwsSolutions-SMG4',
          reason:
            'Aurora master password rotation is planned for M8 (CI/CD hardening) with a rotation Lambda. Dev uses a static generated password behind VPC + SG isolation.',
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(this.uploadsBucket, [
      {
        id: 'AwsSolutions-S1',
        reason:
          'Dedicated log bucket for S3 access logs is added in M8 hardening. Dev relies on CloudTrail + VPC Flow Logs for audit.',
      },
    ]);
    NagSuppressions.addResourceSuppressions(this.redis, [
      {
        id: 'AwsSolutions-AEC4',
        reason:
          'Multi-AZ Redis is enabled only in prod via isProd branch. Dev is single-AZ for cost.',
      },
      {
        id: 'AwsSolutions-AEC5',
        reason:
          'Port obfuscation is not a strong control against targeted attackers. Redis is in a private-isolated subnet behind a locked SG; default port is fine.',
      },
      {
        id: 'AwsSolutions-AEC6',
        reason:
          'Redis AUTH token will be added in M8 hardening. Transit encryption is on; Redis is in private-isolated subnet, SG-locked to the ECS task role.',
      },
    ]);
  }
}
