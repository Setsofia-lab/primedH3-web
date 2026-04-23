/**
 * Per-env configuration for the PrimedHealth CDK app.
 *
 * Account IDs come from infra/bootstrap/accounts.json (source of truth).
 * The qualifier matches the CDK bootstrap (see docs/ADRs/0001).
 */

export const PROJECT = 'primedhealth';

/** Qualifier used by `cdk bootstrap`. Keep in lockstep with infra/bootstrap/accounts.json. */
export const QUALIFIER = 'primedh';

export type EnvName = 'dev' | 'prod';

export interface EnvConfig {
  readonly account: string;
  readonly region: string;
  /** Non-overlapping CIDR per env so VPC peering stays an option later. */
  readonly vpcCidr: string;
  /** 1 in dev (cost), 3 in prod (HA). */
  readonly natGateways: number;
}

export const ENVIRONMENTS: Record<EnvName, EnvConfig> = {
  dev: {
    account: '984126996145',
    region: 'us-east-1',
    vpcCidr: '10.0.0.0/16',
    natGateways: 1,
  },
  prod: {
    account: '492084584502',
    region: 'us-east-1',
    vpcCidr: '10.10.0.0/16',
    natGateways: 3,
  },
};

export function resolveEnv(name: string | undefined): EnvConfig {
  if (!name || !(name in ENVIRONMENTS)) {
    throw new Error(
      `Missing or unknown -c env=<name>. Valid: ${Object.keys(ENVIRONMENTS).join(', ')}`,
    );
  }
  return ENVIRONMENTS[name as EnvName];
}

export function stackName(envName: EnvName, part: string): string {
  return `${PROJECT}-${envName}-${part}`;
}
