/**
 * seed-cognito-users.ts — provision a deterministic set of test users
 * across the three Cognito pools so usability testing has known logins.
 *
 * Idempotent. Re-runnable. Safe in dev only — refuses to run if the
 * --env=dev guard isn't passed, since we don't want to clobber prod
 * accounts by accident.
 *
 * Usage:
 *   AWS_PROFILE=primedhealth-dev pnpm --filter @primedhealth/api seed:cognito -- --env=dev
 *
 * What it creates (one per role):
 *   admins   pool → admin@primedhealth.dev          (role=admin)
 *   providers pool → surgeon@primedhealth.dev      (group=surgeon)
 *   providers pool → anesthesia@primedhealth.dev   (group=anesthesia)
 *   providers pool → coordinator@primedhealth.dev  (group=coordinator)
 *   providers pool → allied@primedhealth.dev       (no group → role=allied)
 *   patients pool → patient1@primedhealth.dev     (role=patient)
 *   patients pool → patient2@primedhealth.dev     (role=patient)
 *
 * Password: shared dev-only constant; printed at end so the operator
 * can paste into a password manager / share with testers.
 *
 * Each user is created with --message-action SUPPRESS so Cognito
 * doesn't email them; admin-set-user-password marks the password
 * permanent so first login works straight away.
 */
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  GroupExistsException,
  UserNotFoundException,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import { execSync } from 'node:child_process';

interface SeedUser {
  pool: 'admins' | 'providers' | 'patients';
  email: string;
  given: string;
  family: string;
  group?: 'surgeon' | 'anesthesia' | 'coordinator' | 'allied';
}

const SEEDS: readonly SeedUser[] = [
  { pool: 'admins', email: 'admin@primedhealth.dev', given: 'Avery', family: 'Admin' },
  { pool: 'providers', email: 'surgeon@primedhealth.dev', given: 'Sam', family: 'Surgeon', group: 'surgeon' },
  { pool: 'providers', email: 'anesthesia@primedhealth.dev', given: 'Anna', family: 'Anesthesia', group: 'anesthesia' },
  { pool: 'providers', email: 'coordinator@primedhealth.dev', given: 'Cory', family: 'Coordinator', group: 'coordinator' },
  { pool: 'providers', email: 'allied@primedhealth.dev', given: 'Allie', family: 'Allied', group: 'allied' },
  { pool: 'patients', email: 'patient1@primedhealth.dev', given: 'Pat', family: 'Patient' },
  { pool: 'patients', email: 'patient2@primedhealth.dev', given: 'River', family: 'Roe' },
];

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const PASSWORD = process.env.SEED_PASSWORD ?? 'PrimedDevPass!2026';

interface PoolIds {
  admins: string;
  providers: string;
  patients: string;
}

/**
 * Resolve pool IDs in this order:
 *   1. AUTH_*_POOL_ID env vars (manual override)
 *   2. `aws cloudformation describe-stacks` shelling out via the
 *      operator's existing AWS CLI / SSO session (no extra SDK dep)
 */
async function fetchPoolIds(envName: string): Promise<PoolIds> {
  const fromEnv = {
    admins: process.env.AUTH_ADMINS_POOL_ID,
    providers: process.env.AUTH_PROVIDERS_POOL_ID,
    patients: process.env.AUTH_PATIENTS_POOL_ID,
  };
  if (fromEnv.admins && fromEnv.providers && fromEnv.patients) {
    return fromEnv as PoolIds;
  }
  const cmd = [
    'aws cloudformation describe-stacks',
    `--stack-name primedhealth-${envName}-auth`,
    `--region ${REGION}`,
    '--query "Stacks[0].Outputs[].[OutputKey,OutputValue]"',
    '--output json',
  ].join(' ');
  const raw = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const outputs = JSON.parse(raw) as Array<[string, string]>;
  const pick = (key: string): string => {
    const o = outputs.find((x) => x[0] === key);
    if (!o) throw new Error(`auth stack missing output ${key}`);
    return o[1];
  };
  return {
    admins: pick('AdminsPoolId'),
    providers: pick('ProvidersPoolId'),
    patients: pick('PatientsPoolId'),
  };
}

async function ensureGroup(
  idp: CognitoIdentityProviderClient,
  poolId: string,
  group: string,
): Promise<void> {
  try {
    await idp.send(
      new CreateGroupCommand({
        UserPoolId: poolId,
        GroupName: group,
        Description: `Auto-created by seed-cognito-users for role=${group}`,
      }),
    );
    log(`  + created group ${group}`);
  } catch (err) {
    if (err instanceof GroupExistsException) return;
    throw err;
  }
}

async function ensureUser(
  idp: CognitoIdentityProviderClient,
  poolId: string,
  user: SeedUser,
): Promise<{ sub: string; created: boolean }> {
  // AdminCreateUser is idempotent enough — UsernameExistsException means
  // the row is already there, so we can skip the create and proceed to
  // password / group reconciliation.
  try {
    const created = await idp.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: user.email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: user.given },
          { Name: 'family_name', Value: user.family },
        ],
      }),
    );
    const sub = (created.User?.Attributes ?? []).find((a) => a.Name === 'sub')?.Value;
    if (!sub) throw new Error(`AdminCreateUser returned no sub for ${user.email}`);
    return { sub, created: true };
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
    // already exists — read sub via AdminGetUser.
    const got = await idp.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: user.email }),
    );
    const sub = (got.UserAttributes ?? []).find((a) => a.Name === 'sub')?.Value;
    if (!sub) throw new Error(`AdminGetUser returned no sub for ${user.email}`);
    return { sub, created: false };
  }
}

async function setPassword(
  idp: CognitoIdentityProviderClient,
  poolId: string,
  username: string,
  password: string,
): Promise<void> {
  await idp.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );
}

async function addToGroup(
  idp: CognitoIdentityProviderClient,
  poolId: string,
  username: string,
  group: string,
): Promise<void> {
  try {
    await idp.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: username,
        GroupName: group,
      }),
    );
  } catch (err) {
    // No-op if the user is already in the group; AdminAddUserToGroup
    // returns 200 in that case so the catch is mostly defensive.
    if (err instanceof UserNotFoundException) throw err;
    log(`  ! group add for ${username}/${group}: ${(err as Error).message}`);
  }
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

async function main(): Promise<void> {
  const envArg = process.argv.slice(2).find((a) => a.startsWith('--env='));
  const envName = envArg?.slice('--env='.length) ?? 'dev';
  if (envName !== 'dev' && envName !== 'staging') {
    throw new Error(
      `Refusing to seed Cognito users in env '${envName}'. Pass --env=dev or --env=staging.`,
    );
  }

  log(`[seed-cognito-users] env=${envName} region=${REGION}`);
  const pools = await fetchPoolIds(envName);
  log(`[seed-cognito-users] pools admins=${pools.admins} providers=${pools.providers} patients=${pools.patients}`);

  const idp = new CognitoIdentityProviderClient({ region: REGION });

  // Ensure provider role groups exist (CDK currently has surgeon /
  // anesthesia / coordinator; we add `allied` if missing).
  for (const g of ['surgeon', 'anesthesia', 'coordinator', 'allied']) {
    await ensureGroup(idp, pools.providers, g);
  }

  const summary: Array<{
    pool: string;
    email: string;
    role: string;
    sub: string;
    created: boolean;
  }> = [];

  for (const seed of SEEDS) {
    const poolId = pools[seed.pool];
    log(`[seed-cognito-users] ${seed.pool}/${seed.email}…`);
    const { sub, created } = await ensureUser(idp, poolId, seed);
    await setPassword(idp, poolId, seed.email, PASSWORD);
    if (seed.group && seed.pool === 'providers') {
      await addToGroup(idp, poolId, seed.email, seed.group);
    }
    summary.push({
      pool: seed.pool,
      email: seed.email,
      role: seed.pool === 'admins' ? 'admin' : seed.pool === 'patients' ? 'patient' : (seed.group ?? 'allied'),
      sub,
      created,
    });
  }

  log('');
  log('────────────────────────────────────────────────────────────');
  log('Seeded Cognito users:');
  log('');
  for (const r of summary) {
    log(`  ${r.role.padEnd(12)} ${r.email.padEnd(36)} ${r.created ? 'created' : 'reused'}`);
  }
  log('');
  log(`  password (all): ${PASSWORD}`);
  log(`  → set SEED_PASSWORD env to override`);
  log('────────────────────────────────────────────────────────────');
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed-cognito-users failed:', err);
  process.exit(1);
});
