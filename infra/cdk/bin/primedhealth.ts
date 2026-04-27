#!/usr/bin/env node
/**
 * PrimedHealth CDK entry point.
 *
 * Usage:
 *   cdk synth -c env=dev
 *   cdk deploy -c env=dev --all
 *
 * Env is required; no default. This prevents accidental prod deploys.
 */
import 'source-map-support/register';
import { App, Aspects, DefaultStackSynthesizer, Tags } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NetworkStack } from '../lib/network-stack';
import { SecretsStack } from '../lib/secrets-stack';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { ObservabilityStack } from '../lib/observability-stack';
import { ApiStack } from '../lib/api-stack';
import { AgentStack } from '../lib/agent-stack';
import { CicdStack } from '../lib/cicd-stack';
import { PROJECT, QUALIFIER, resolveEnv, stackName } from '../lib/config';

const app = new App();

const envName = app.node.tryGetContext('env') as string | undefined;
const cfg = resolveEnv(envName);
const typedEnv = envName as 'dev' | 'prod';

const synthesizer = new DefaultStackSynthesizer({ qualifier: QUALIFIER });
const env = { account: cfg.account, region: cfg.region };
const common = { env, synthesizer };

// --- Stacks in dependency order ---

const network = new NetworkStack(app, stackName(typedEnv, 'network'), {
  ...common,
  envName: typedEnv,
  description: `VPC + subnets + NAT + flow logs (${typedEnv})`,
});

const secrets = new SecretsStack(app, stackName(typedEnv, 'secrets'), {
  ...common,
  envName: typedEnv,
  description: `KMS CMK + Secrets Manager placeholders (${typedEnv})`,
});

const data = new DataStack(app, stackName(typedEnv, 'data'), {
  ...common,
  envName: typedEnv,
  vpc: network.vpc,
  cmk: secrets.cmk,
  description: `Aurora + Redis + S3 uploads + SQS (${typedEnv})`,
});

const auth = new AuthStack(app, stackName(typedEnv, 'auth'), {
  ...common,
  envName: typedEnv,
  description: `Cognito pools: admins, providers, patients (${typedEnv})`,
});

const observability = new ObservabilityStack(app, stackName(typedEnv, 'observability'), {
  ...common,
  envName: typedEnv,
  cmk: secrets.cmk,
  alertEmail: 'setsofiaeli@gmail.com',
  description: `App log groups + SNS alerts topic (${typedEnv})`,
});

const api = new ApiStack(app, stackName(typedEnv, 'api'), {
  ...common,
  envName: typedEnv,
  vpc: network.vpc,
  cmk: secrets.cmk,
  aurora: data.aurora,
  auroraSecurityGroup: data.auroraSecurityGroup,
  redis: data.redis,
  redisSecurityGroup: data.redisSecurityGroup,
  uploadsBucket: data.uploadsBucket,
  agentQueue: data.agentQueue,
  apiLogGroup: observability.apiLogGroup,
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
  description: `ECS Fargate api + ALB (${typedEnv})`,
});

// Agent worker — Phase 3 M11.
const agent = new AgentStack(app, stackName(typedEnv, 'agents'), {
  ...common,
  envName: typedEnv,
  vpc: network.vpc,
  cmk: secrets.cmk,
  aurora: data.aurora,
  auroraSecurityGroup: data.auroraSecurityGroup,
  redis: data.redis,
  redisSecurityGroup: data.redisSecurityGroup,
  agentQueue: data.agentQueue,
  agentDlq: data.agentDlq,
  apiLogGroup: observability.apiLogGroup,
  langsmithApiKey: secrets.langsmithApiKey,
  description: `ECS Fargate agent worker (${typedEnv})`,
});

// CI/CD — GitHub Actions OIDC trust + deployer role.
// Branch-per-env: dev <- staging, prod <- main.
const cicd = new CicdStack(app, stackName(typedEnv, 'cicd'), {
  ...common,
  envName: typedEnv,
  githubRepo: 'Setsofia-lab/primedH3-web',
  branch: typedEnv === 'prod' ? 'main' : 'staging',
  clusterName: `primedhealth-${typedEnv}`,
  description: `GitHub Actions OIDC + deployer role (${typedEnv})`,
});

// App-wide tags
Tags.of(app).add('Project', PROJECT);
Tags.of(app).add('Env', typedEnv);
Tags.of(app).add('ManagedBy', 'cdk');

// Enforce AWS Solutions best practices via cdk-nag on every stack
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Keep lint happy — referenced implicitly through CFN outputs.
void api;
void agent;
void cicd;
