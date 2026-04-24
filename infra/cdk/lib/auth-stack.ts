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
}

export class AuthStack extends Stack {
  public readonly admins: PoolClients;
  public readonly providers: PoolClients;
  public readonly patients: PoolClients;
  public readonly domain: cognito.UserPoolDomain;

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
    const callbackUrls = webOrigins.map((u) => `${u}/auth/callback`);
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

    // --- Admins pool ---
    const adminsPool = new cognito.UserPool(this, 'AdminsPool', {
      ...commonPoolProps,
      userPoolName: `primedhealth-${props.envName}-admins`,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
    });
    const adminsClient = adminsPool.addClient('AdminsAppClient', {
      ...commonClientProps(),
      userPoolClientName: `primedhealth-${props.envName}-admins-web`,
    });
    this.admins = { pool: adminsPool, client: adminsClient };

    // --- Providers pool ---
    const providersPool = new cognito.UserPool(this, 'ProvidersPool', {
      ...commonPoolProps,
      userPoolName: `primedhealth-${props.envName}-providers`,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
    });
    const providersClient = providersPool.addClient('ProvidersAppClient', {
      ...commonClientProps(),
      userPoolClientName: `primedhealth-${props.envName}-providers-web`,
    });
    this.providers = { pool: providersPool, client: providersClient };

    // --- Patients pool (optional MFA, CUSTOM_AUTH for magic-link) ---
    const patientsPool = new cognito.UserPool(this, 'PatientsPool', {
      ...commonPoolProps,
      userPoolName: `primedhealth-${props.envName}-patients`,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
    });
    const patientsClient = patientsPool.addClient('PatientsAppClient', {
      ...commonClientProps(),
      userPoolClientName: `primedhealth-${props.envName}-patients-web`,
      authFlows: { custom: true, userSrp: true },
      refreshTokenValidity: Duration.days(90),
    });
    this.patients = { pool: patientsPool, client: patientsClient };

    // --- Shared hosted-UI domain ---
    // Cognito-prefix domain is scoped to the admins pool but works for
    // sibling pools via `?client_id=...` on the hosted UI URL. A custom
    // domain (auth.dev.primed.ai) replaces this in M2.
    this.domain = adminsPool.addDomain('HostedUiDomain', {
      cognitoDomain: {
        domainPrefix: `primedhealth-${props.envName}`,
      },
    });

    // --- Outputs (consumed by ApiStack + web) ---
    new CfnOutput(this, 'Region', { value: this.region });
    new CfnOutput(this, 'HostedUiDomain', {
      value: `${this.domain.domainName}.auth.${this.region}.amazoncognito.com`,
    });
    new CfnOutput(this, 'AdminsPoolId', { value: adminsPool.userPoolId });
    new CfnOutput(this, 'AdminsClientId', { value: adminsClient.userPoolClientId });
    new CfnOutput(this, 'ProvidersPoolId', { value: providersPool.userPoolId });
    new CfnOutput(this, 'ProvidersClientId', {
      value: providersClient.userPoolClientId,
    });
    new CfnOutput(this, 'PatientsPoolId', { value: patientsPool.userPoolId });
    new CfnOutput(this, 'PatientsClientId', {
      value: patientsClient.userPoolClientId,
    });

    // --- Nag suppressions ---
    NagSuppressions.addResourceSuppressions(patientsPool, [
      {
        id: 'AwsSolutions-COG2',
        reason:
          'Patient pool uses CUSTOM_AUTH for magic-link/OTP; mandatory TOTP MFA on a consumer PWA would harm adoption. Step-up MFA on sensitive actions lands in M6b.',
      },
    ]);
    for (const p of [adminsPool, providersPool, patientsPool]) {
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
