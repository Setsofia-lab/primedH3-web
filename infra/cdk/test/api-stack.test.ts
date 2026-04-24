import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { NetworkStack } from '../lib/network-stack';
import { ObservabilityStack } from '../lib/observability-stack';
import { SecretsStack } from '../lib/secrets-stack';

/**
 * Smoke-test that the full dev app synthesizes and wires its cross-stack
 * references correctly. We don't run cdk-nag here (too slow for unit
 * tests); nag enforcement lives in `cdk synth` inside CI.
 */
describe('full dev stack set', () => {
  const env = { account: '984126996145', region: 'us-east-1' };

  it('synthesizes all 6 stacks and the api service points at the correct cluster + targets', () => {
    const app = new App();

    const network = new NetworkStack(app, 'net', { env, envName: 'dev' });
    const secrets = new SecretsStack(app, 'sec', { env, envName: 'dev' });
    const data = new DataStack(app, 'data', {
      env,
      envName: 'dev',
      vpc: network.vpc,
      cmk: secrets.cmk,
    });
    const obs = new ObservabilityStack(app, 'obs', {
      env,
      envName: 'dev',
      cmk: secrets.cmk,
      alertEmail: 'test@example.com',
    });
    const auth = new AuthStack(app, 'auth', { env, envName: 'dev' });
    const api = new ApiStack(app, 'api', {
      env,
      envName: 'dev',
      vpc: network.vpc,
      cmk: secrets.cmk,
      aurora: data.aurora,
      auroraSecurityGroup: data.auroraSecurityGroup,
      redis: data.redis,
      redisSecurityGroup: data.redisSecurityGroup,
      uploadsBucket: data.uploadsBucket,
      apiLogGroup: obs.apiLogGroup,
      athenaPrivateJwk: secrets.athenaPrivateJwk,
      cognitoAdmins: {
        poolId: auth.admins.pool.userPoolId,
        clientId: auth.admins.client.userPoolClientId,
      },
      cognitoProviders: {
        poolId: auth.providers.pool.userPoolId,
        clientId: auth.providers.client.userPoolClientId,
      },
      cognitoPatients: {
        poolId: auth.patients.pool.userPoolId,
        clientId: auth.patients.client.userPoolClientId,
      },
    });

    const t = Template.fromStack(api);
    t.resourceCountIs('AWS::ECS::Cluster', 1);
    // api service task def + one-shot migrate task def
    t.resourceCountIs('AWS::ECS::TaskDefinition', 2);
    t.resourceCountIs('AWS::ECS::Service', 1);
    t.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    t.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
    t.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);

    // Target group hits /health over HTTP
    t.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/health',
    });

    // Dev sizing: single task
    t.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 1 });

    // Prod test: 2 tasks
    const appProd = new App();
    const netProd = new NetworkStack(appProd, 'netp', {
      env: { account: '492084584502', region: 'us-east-1' },
      envName: 'prod',
    });
    const secProd = new SecretsStack(appProd, 'secp', {
      env: { account: '492084584502', region: 'us-east-1' },
      envName: 'prod',
    });
    const dataProd = new DataStack(appProd, 'datap', {
      env: { account: '492084584502', region: 'us-east-1' },
      envName: 'prod',
      vpc: netProd.vpc,
      cmk: secProd.cmk,
    });
    const obsProd = new ObservabilityStack(appProd, 'obsp', {
      env: { account: '492084584502', region: 'us-east-1' },
      envName: 'prod',
      cmk: secProd.cmk,
      alertEmail: 'test@example.com',
    });
    const authProd = new AuthStack(appProd, 'authp', {
      env: { account: '492084584502', region: 'us-east-1' },
      envName: 'prod',
    });
    const apiProd = new ApiStack(appProd, 'apip', {
      env: { account: '492084584502', region: 'us-east-1' },
      envName: 'prod',
      vpc: netProd.vpc,
      cmk: secProd.cmk,
      aurora: dataProd.aurora,
      auroraSecurityGroup: dataProd.auroraSecurityGroup,
      redis: dataProd.redis,
      redisSecurityGroup: dataProd.redisSecurityGroup,
      uploadsBucket: dataProd.uploadsBucket,
      apiLogGroup: obsProd.apiLogGroup,
      athenaPrivateJwk: secProd.athenaPrivateJwk,
      cognitoAdmins: {
        poolId: authProd.admins.pool.userPoolId,
        clientId: authProd.admins.client.userPoolClientId,
      },
      cognitoProviders: {
        poolId: authProd.providers.pool.userPoolId,
        clientId: authProd.providers.client.userPoolClientId,
      },
      cognitoPatients: {
        poolId: authProd.patients.pool.userPoolId,
        clientId: authProd.patients.client.userPoolClientId,
      },
    });
    Template.fromStack(apiProd).hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 2,
    });

    expect(api.service).toBeDefined();
  });
});
