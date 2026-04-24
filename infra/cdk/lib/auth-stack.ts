/**
 * AuthStack — Cognito user pools for the three role groups.
 *
 * Constitution §5.2: "Cognito user pools (one per role group)."
 *
 * Three separate pools (not one with groups) so:
 *  - Patient sign-in UX (magic-link / OTP) doesn't mix with provider MFA.
 *  - Per-pool Lambda triggers stay simple.
 *  - Provider pool can federate to facility IdPs later without touching
 *    the patient pool.
 *
 * Each pool gets:
 *  - A dedicated app client (PKCE, token revocation, 1h access token).
 *  - OAuth authorization-code grant with `openid email profile` scopes.
 *  - A shared Cognito-prefix hosted UI domain so the web app can redirect
 *    into Cognito for login without needing a custom domain yet
 *    (auth.dev.primed.ai is wired in M2 once DNS is delegated).
 *
 * Stack outputs are consumed by ApiStack (env vars on the api task) and
 * by the web app (NEXT_PUBLIC_* build-time config).
 */

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';

export interface AuthStackProps extends StackProps {
  readonly envName: EnvName;
}

interface PoolClients {
  readonly pool: cognito.UserPool;
  readonly client: cognito.UserPoolClient;
  readonly domain: cognito.UserPoolDomain;
  readonly domainName: string;
}

export class AuthStack extends Stack {
  public readonly admins: PoolClients;
  public readonly providers: PoolClients;
  public readonly patients: PoolClients;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';
    const destroyPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Callback + logout URLs per env. Localhost is always allowed so
    // local dev can hit the hosted UI without a deploy. Vercel previews
    // + prod origin come from the domain plan (primed.ai M2).
    const webOrigins = isProd
      ? ['https://app.primed.ai', 'https://staging.primed.ai']
      : [
          'http://localhost:3000',
          'https://primedh3-web.vercel.app',
          'https://staging.primed.ai',
          // Add Vercel preview wildcard once we set up a branch-specific domain.
        ];
    // Next.js App Router route handlers live under /api — the web uses
    // /api/auth/callback for the token exchange and /auth/signed-out as
    // the post-logout landing page (plain App Router page).
    const callbackUrls = webOrigins.map((u) => `${u}/api/auth/callback`);
    const logoutUrls = webOrigins.map((u) => `${u}/auth/signed-out`);

    const commonPoolProps: Omit<cognito.UserPoolProps, 'userPoolName'> = {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: destroyPolicy,
      deletionProtection: isProd,
    };

    const commonClientProps = (): cognito.UserPoolClientOptions => ({
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      authFlows: { userSrp: true },
      generateSecret: false, // public client — PKCE instead of secret
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
    });

    const mkPool = (
      id: string,
      kind: 'admins' | 'providers' | 'patients',
      mfa: cognito.Mfa,
      extraClient: Partial<cognito.UserPoolClientOptions> = {},
    ): PoolClients => {
      const pool = new cognito.UserPool(this, `${id}Pool`, {
        ...commonPoolProps,
        userPoolName: `primedhealth-${props.envName}-${kind}`,
        mfa,
        mfaSecondFactor: { sms: false, otp: true },
      });
      const client = pool.addClient(`${id}AppClient`, {
        ...commonClientProps(),
        userPoolClientName: `primedhealth-${props.envName}-${kind}-web`,
        ...extraClient,
      });
      // Each pool gets its own Cognito-prefix hosted-UI domain; custom
      // domain (auth.dev.primed.ai) replaces these in M2.
      const domainPrefix = `primedhealth-${props.envName}-${kind}`;
      const domain = pool.addDomain(`${id}HostedUi`, {
        cognitoDomain: { domainPrefix },
      });
      const domainName = `${domainPrefix}.auth.${this.region}.amazoncognito.com`;
      return { pool, client, domain, domainName };
    };

    this.admins = mkPool('Admins', 'admins', cognito.Mfa.REQUIRED);
    this.providers = mkPool('Providers', 'providers', cognito.Mfa.REQUIRED);
    this.patients = mkPool('Patients', 'patients', cognito.Mfa.OPTIONAL, {
      // Patients pool: CUSTOM_AUTH for magic-link/OTP, longer refresh
      // token TTL for a PWA install.
      authFlows: { custom: true, userSrp: true },
      refreshTokenValidity: Duration.days(90),
    });

    // --- Outputs (consumed by ApiStack + web build-time config) ---
    new CfnOutput(this, 'Region', { value: this.region });
    new CfnOutput(this, 'AdminsPoolId', { value: this.admins.pool.userPoolId });
    new CfnOutput(this, 'AdminsClientId', { value: this.admins.client.userPoolClientId });
    new CfnOutput(this, 'AdminsDomain', { value: this.admins.domainName });
    new CfnOutput(this, 'ProvidersPoolId', { value: this.providers.pool.userPoolId });
    new CfnOutput(this, 'ProvidersClientId', {
      value: this.providers.client.userPoolClientId,
    });
    new CfnOutput(this, 'ProvidersDomain', { value: this.providers.domainName });
    new CfnOutput(this, 'PatientsPoolId', { value: this.patients.pool.userPoolId });
    new CfnOutput(this, 'PatientsClientId', {
      value: this.patients.client.userPoolClientId,
    });
    new CfnOutput(this, 'PatientsDomain', { value: this.patients.domainName });

    // --- Nag suppressions ---
    NagSuppressions.addResourceSuppressions(this.patients.pool, [
      {
        id: 'AwsSolutions-COG2',
        reason:
          'Patient pool uses CUSTOM_AUTH for magic-link/OTP; mandatory TOTP MFA on a consumer PWA would harm adoption. Step-up MFA on sensitive actions lands in M6b.',
      },
    ]);
    for (const p of [this.admins.pool, this.providers.pool, this.patients.pool]) {
      NagSuppressions.addResourceSuppressions(p, [
        {
          id: 'AwsSolutions-COG8',
          reason:
            'Cognito Plus tier has per-MAU cost; upgrade in M10 before prod pilot goes live.',
        },
      ]);
    }
  }
}
