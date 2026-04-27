/**
 * SecretsStack — customer-managed KMS CMK + placeholder Secrets Manager entries.
 *
 * Why its own stack:
 *  - KMS keys have long deletion windows; isolating in a dedicated stack
 *    keeps them safe from accidental nukes of data/auth stacks.
 *  - Other stacks grant themselves kms:Decrypt via this stack's output.
 *
 * Secrets created empty (placeholders). Real values get set manually
 * via AWS Secrets Manager console or `aws secretsmanager put-secret-value`
 * so plaintext never lands in git or in CDK context.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';

export interface SecretsStackProps extends StackProps {
  readonly envName: EnvName;
}

export class SecretsStack extends Stack {
  public readonly cmk: kms.Key;
  public readonly athenaPrivateJwk: sm.Secret;
  public readonly langsmithApiKey: sm.Secret;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    // Customer-managed key for all app-layer encryption (secrets, RDS, S3 uploads).
    this.cmk = new kms.Key(this, 'AppCmk', {
      alias: `alias/primedhealth-${props.envName}`,
      description: `PrimedHealth ${props.envName} customer-managed KMS key`,
      enableKeyRotation: true,
      pendingWindow: Duration.days(props.envName === 'prod' ? 30 : 7),
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Placeholder: Athena JWK private key (set manually after app creation).
    // Aurora master password is auto-generated and owned by DataStack to
    // avoid a stack cycle (Aurora wants to mutate the secret for rotation).
    this.athenaPrivateJwk = new sm.Secret(this, 'AthenaPrivateJwk', {
      secretName: `/primedhealth/${props.envName}/athena/private-jwk`,
      description: `Athena client-assertion private JWK (${props.envName}). Populate via put-secret-value.`,
      encryptionKey: this.cmk,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // The Athena JWK private key is an externally-issued keypair; automatic
    // rotation isn't applicable. Rotation happens when we generate a new
    // keypair and register the new public JWK with Athena manually.
    NagSuppressions.addResourceSuppressions(this.athenaPrivateJwk, [
      {
        id: 'AwsSolutions-SMG4',
        reason:
          'Athena client-assertion JWK is externally-registered; rotation is a manual keypair regeneration + Athena app update, not automatable.',
      },
    ]);

    // LangSmith API key (M16). Externally-issued by smith.langchain.com;
    // populate manually after stack creation:
    //   aws secretsmanager put-secret-value \
    //     --secret-id /primedhealth/<env>/langsmith/api-key \
    //     --secret-string 'lsv2_pt_...'
    // The worker reads it via the secret-resolver; the tracer is a
    // no-op when the secret is empty, so the worker is fine to run
    // before the key is set.
    this.langsmithApiKey = new sm.Secret(this, 'LangSmithApiKey', {
      secretName: `/primedhealth/${props.envName}/langsmith/api-key`,
      description: `LangSmith API key (${props.envName}). Populate via put-secret-value once the workspace is provisioned.`,
      encryptionKey: this.cmk,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    NagSuppressions.addResourceSuppressions(this.langsmithApiKey, [
      {
        id: 'AwsSolutions-SMG4',
        reason:
          'LangSmith key is externally-issued by smith.langchain.com; rotation is a manual key regeneration in the LangSmith console, not automatable.',
      },
    ]);
  }
}
