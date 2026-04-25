/**
 * CicdStack — GitHub Actions OIDC trust + deployer role.
 *
 * Set up once per environment (dev / prod). After this lands:
 *   - GitHub Actions can `aws-actions/configure-aws-credentials@v4` with
 *     `role-to-assume = <DeployerRoleArn>` and `audience: sts.amazonaws.com`
 *     to obtain short-lived AWS credentials. No static keys in the repo.
 *
 * Trust is locked to `repo:Setsofia-lab/primedH3-web:ref:refs/heads/<branch>`
 * so a fork can't impersonate us. Branches: `main` for prod, `staging`
 * for dev. The PR branch glob (`pull_request:*`) is intentionally not
 * trusted — PRs run lint/typecheck/test only, never deploy.
 *
 * The role is broad-but-scoped: it can assume the CDK toolkit roles
 * (deploy / lookup / file-publishing / image-publishing) created by
 * `cdk bootstrap`, and run ECS run-task for the migrate one-shot. It
 * has no persistent privileges to the workload itself.
 */
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import type { EnvName } from './config';

export interface CicdStackProps extends StackProps {
  readonly envName: EnvName;
  /** GitHub org/repo, e.g. "Setsofia-lab/primedH3-web". */
  readonly githubRepo: string;
  /** Which git branch is allowed to assume this role. */
  readonly branch: string;
  /** Cluster name (for the migrate run-task constraint). */
  readonly clusterName: string;
}

export class CicdStack extends Stack {
  public readonly deployerRoleArn: string;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    // GitHub's official OIDC issuer. The thumbprint comes from
    // https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
    // and is rarely rotated; AWS keeps it pinned for trust evaluation.
    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const subject = `repo:${props.githubRepo}:ref:refs/heads/${props.branch}`;

    const deployer = new iam.Role(this, 'DeployerRole', {
      roleName: `primedhealth-${props.envName}-gh-deployer`,
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': subject,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description: `GitHub Actions deployer for ${props.envName} (${subject})`,
      maxSessionDuration: undefined,
    });

    // Allow assuming the CDK bootstrap roles (deploy/file-publish/etc.).
    deployer.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkToolkitRoles',
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-primedh-deploy-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-primedh-file-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-primedh-image-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-primedh-lookup-role-${this.account}-${this.region}`,
        ],
      }),
    );

    // Allow running the migrate one-shot task after deploy.
    deployer.addToPolicy(
      new iam.PolicyStatement({
        sid: 'RunMigrateTask',
        actions: [
          'ecs:RunTask',
          'ecs:DescribeTasks',
          'ecs:ListTasks',
          'ecs:StopTask',
          'logs:GetLogEvents',
          'logs:FilterLogEvents',
          'cloudformation:DescribeStacks',
        ],
        resources: ['*'],
      }),
    );

    // PassRole for the migrate task definition's exec + task roles.
    deployer.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PassRoleForEcsTasks',
        actions: ['iam:PassRole'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' },
        },
      }),
    );

    this.deployerRoleArn = deployer.roleArn;

    new CfnOutput(this, 'DeployerRoleArn', { value: deployer.roleArn });
    new CfnOutput(this, 'GithubOidcProviderArn', {
      value: provider.openIdConnectProviderArn,
    });

    // The ECS RunTask + iam:PassRole grants need wildcard resources
    // because the migrate task definition's ARN changes on every deploy
    // (CFN replaces the resource each time). Scoping to specific tasks
    // would require pre-creating them or using a name-based pattern,
    // which CFN doesn't expose for taskDefinition arn families. The
    // PassRole is conditioned on `iam:PassedToService=ecs-tasks` which
    // is the standard recommendation.
    NagSuppressions.addResourceSuppressions(
      deployer,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'GitHub deployer needs wildcard ECS RunTask + iam:PassRole ' +
            '(scoped to ecs-tasks service). Task def ARNs change each ' +
            'deploy; sts:AssumeRole is scoped to the four CDK toolkit roles.',
          appliesTo: [
            'Resource::*',
            'Action::ecs:*',
            'Action::logs:*',
          ],
        },
      ],
      true,
    );
  }
}
