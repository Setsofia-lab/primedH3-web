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
 * Each pool gets a dedicated app client. Client secrets live in
 * Secrets Manager (wired in M4 when the API consumes them).
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import type { EnvName } from './config';

export interface AuthStackProps extends StackProps {
  readonly envName: EnvName;
}

export class AuthStack extends Stack {
  public readonly adminsPool: cognito.UserPool;
  public readonly providersPool: cognito.UserPool;
  public readonly patientsPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';
    const destroyPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

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

    // --- Admins pool (facility staff with full access) ---
    this.adminsPool = new cognito.UserPool(this, 'AdminsPool', {
      ...commonPoolProps,
      userPoolName: `primedhealth-${props.envName}-admins`,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
    });

    this.adminsPool.addClient('AdminsAppClient', {
      userPoolClientName: `primedhealth-${props.envName}-admins-web`,
      authFlows: { userSrp: true, userPassword: false },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // --- Providers pool (surgeons, anesthesia, coordinators, allied) ---
    this.providersPool = new cognito.UserPool(this, 'ProvidersPool', {
      ...commonPoolProps,
      userPoolName: `primedhealth-${props.envName}-providers`,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
    });

    this.providersPool.addClient('ProvidersAppClient', {
      userPoolClientName: `primedhealth-${props.envName}-providers-web`,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // --- Patients pool (magic-link / OTP, mobile PWA) ---
    this.patientsPool = new cognito.UserPool(this, 'PatientsPool', {
      ...commonPoolProps,
      userPoolName: `primedhealth-${props.envName}-patients`,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      // Patients: allow CUSTOM_AUTH for magic-link flow (Lambda triggers wired in M6)
    });

    this.patientsPool.addClient('PatientsAppClient', {
      userPoolClientName: `primedhealth-${props.envName}-patients-web`,
      authFlows: { custom: true, userSrp: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(90), // longer for patient PWA
    });

    // --- Nag suppressions ---
    NagSuppressions.addResourceSuppressions(this.patientsPool, [
      {
        id: 'AwsSolutions-COG2',
        reason:
          'Patient pool uses CUSTOM_AUTH for magic-link/OTP; mandatory TOTP MFA on a consumer PWA would harm adoption. Step-up MFA on sensitive actions comes in M6.',
      },
    ]);

    for (const pool of [this.adminsPool, this.providersPool, this.patientsPool]) {
      NagSuppressions.addResourceSuppressions(pool, [
        {
          id: 'AwsSolutions-COG8',
          reason:
            'Cognito Plus tier has per-MAU cost; we will upgrade in M10 before prod pilot goes live.',
        },
      ]);
    }
  }
}
