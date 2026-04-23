/**
 * ObservabilityStack — app log groups, alarm topic, budget alerts.
 *
 * MVP scope:
 *  - SNS topic for alarms (subscribed to setsofiaeli@gmail.com in dev).
 *  - App log groups with KMS encryption + retention policies.
 *  - Metric filter: CloudTrail unauthorized API calls → alarm.
 *
 * Grows in M8 (CI/CD + security tooling) with ZAP, dashboards, X-Ray
 * service map.
 */

import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import type { EnvName } from './config';

export interface ObservabilityStackProps extends StackProps {
  readonly envName: EnvName;
  readonly cmk: kms.IKey;
  readonly alertEmail: string;
}

export class ObservabilityStack extends Stack {
  public readonly alertsTopic: sns.Topic;
  public readonly apiLogGroup: logs.LogGroup;
  public readonly workerLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';
    const retention = isProd ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_MONTH;
    const destroyPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // --- Alerts topic ---
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `primedhealth-${props.envName}-alerts`,
      displayName: `PrimedHealth ${props.envName} alerts`,
      masterKey: props.cmk,
    });
    this.alertsTopic.addSubscription(new subs.EmailSubscription(props.alertEmail));

    // Grant CloudWatch Logs service permission to use the CMK
    // (required so log groups can be encrypted with our customer-managed key).
    props.cmk.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudWatchLogs',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal(`logs.${this.region}.amazonaws.com`)],
        actions: [
          'kms:Encrypt*',
          'kms:Decrypt*',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:Describe*',
        ],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${this.region}:${this.account}:log-group:*`,
          },
        },
      }),
    );

    // --- App log groups (ECS tasks write here) ---
    this.apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/ecs/primedhealth-${props.envName}/api`,
      retention,
      removalPolicy: destroyPolicy,
      encryptionKey: props.cmk,
    });

    this.workerLogGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/ecs/primedhealth-${props.envName}/worker`,
      retention,
      removalPolicy: destroyPolicy,
      encryptionKey: props.cmk,
    });
  }
}
