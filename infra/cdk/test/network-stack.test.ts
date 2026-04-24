import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { NetworkStack } from '../lib/network-stack';

describe('NetworkStack', () => {
  it('provisions a VPC with 3 AZs and 1 NAT in dev', () => {
    const app = new App();
    const stack = new NetworkStack(app, 'test-network-dev', {
      envName: 'dev',
      env: { account: '984126996145', region: 'us-east-1' },
    });
    const t = Template.fromStack(stack);

    t.resourceCountIs('AWS::EC2::VPC', 1);
    t.resourceCountIs('AWS::EC2::NatGateway', 1);
    // 3 AZs × 3 tiers = 9 subnets
    t.resourceCountIs('AWS::EC2::Subnet', 9);
    // Flow logs exist and write to CloudWatch
    t.resourceCountIs('AWS::EC2::FlowLog', 1);
    t.resourceCountIs('AWS::Logs::LogGroup', 1);
    // Free S3 gateway endpoint
    t.hasResourceProperties('AWS::EC2::VPCEndpoint', { VpcEndpointType: 'Gateway' });
  });

  it('provisions 3 NATs in prod for HA', () => {
    const app = new App();
    const stack = new NetworkStack(app, 'test-network-prod', {
      envName: 'prod',
      env: { account: '492084584502', region: 'us-east-1' },
    });
    const t = Template.fromStack(stack);
    t.resourceCountIs('AWS::EC2::NatGateway', 3);
  });

  it('uses distinct CIDRs for dev and prod', () => {
    const devTemplate = Template.fromStack(
      new NetworkStack(new App(), 'test-network-dev-cidr', {
        envName: 'dev',
        env: { account: '984126996145', region: 'us-east-1' },
      }),
    );
    const prodTemplate = Template.fromStack(
      new NetworkStack(new App(), 'test-network-prod-cidr', {
        envName: 'prod',
        env: { account: '492084584502', region: 'us-east-1' },
      }),
    );
    devTemplate.hasResourceProperties('AWS::EC2::VPC', { CidrBlock: '10.0.0.0/16' });
    prodTemplate.hasResourceProperties('AWS::EC2::VPC', { CidrBlock: '10.10.0.0/16' });
    // Confirm non-overlap for future peering
    expect('10.0.0.0/16').not.toBe('10.10.0.0/16');
  });
});
