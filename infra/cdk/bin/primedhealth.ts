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
import { PROJECT, QUALIFIER, resolveEnv, stackName } from '../lib/config';

const app = new App();

const envName = app.node.tryGetContext('env') as string | undefined;
const cfg = resolveEnv(envName);
const typedEnv = envName as 'dev' | 'prod';

const synthesizer = new DefaultStackSynthesizer({ qualifier: QUALIFIER });
const env = { account: cfg.account, region: cfg.region };

const network = new NetworkStack(app, stackName(typedEnv, 'network'), {
  env,
  envName: typedEnv,
  synthesizer,
  description: `VPC + subnets + NAT + flow logs (${typedEnv})`,
});

// App-wide tags
Tags.of(app).add('Project', PROJECT);
Tags.of(app).add('Env', typedEnv);
Tags.of(app).add('ManagedBy', 'cdk');

// Enforce AWS Solutions best practices via cdk-nag on every stack
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Silence noisy "used" variable lint — retain the reference for future cross-stack wiring
void network;
