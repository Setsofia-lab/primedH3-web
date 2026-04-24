/**
 * NetworkStack — VPC, subnets, NAT, flow logs, S3 gateway endpoint.
 *
 * Design goals:
 *  - 3 AZs across us-east-1 (a/b/c) for HA.
 *  - Three subnet tiers: public (ALB), private-with-egress (ECS tasks),
 *    private-isolated (RDS, ElastiCache).
 *  - Cost-aware: 1 NAT in dev, 3 NATs in prod (HA).
 *  - VPC Flow Logs to CloudWatch for HIPAA audit trail.
 *  - Default security group locked (via cdk.json feature flag
 *    `@aws-cdk/aws-ec2:restrictDefaultSecurityGroup`).
 *  - S3 gateway endpoint (free) so container image pulls from ECR and
 *    SecretsManager don't round-trip through NAT.
 */

import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';
import { ENVIRONMENTS } from './config';

export interface NetworkStackProps extends StackProps {
  readonly envName: EnvName;
}

export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const cfg = ENVIRONMENTS[props.envName];

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(cfg.vpcCidr),
      maxAzs: 3,
      natGateways: cfg.natGateways,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Flow Logs → CloudWatch (HIPAA audit trail at the network layer)
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
      logGroupName: `/aws/vpc/${id}/flow-logs`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const flowLogRole = new iam.Role(this, 'VpcFlowLogRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new ec2.FlowLog(this, 'FlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup, flowLogRole),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Free gateway endpoints — traffic never touches NAT/internet
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Narrow suppressions for intentional-by-design findings only.
    NagSuppressions.addResourceSuppressions(flowLogRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'VPC Flow Logs role uses the VPC-scoped managed permissions granted by toCloudWatchLogs; no wildcard resource is attached by our code.',
      },
    ]);
  }
}
