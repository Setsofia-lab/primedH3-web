/**
 * Demo-data seed (B3 — usability testing bootstrap).
 *
 * Idempotent: deterministic UUIDs derived from email/keys, ON CONFLICT
 * (id) DO UPDATE on every row. Re-run-safe.
 *
 * Invoked from migrate.ts when env var SEED_DEMO_DATA=1. The migrate
 * ECS task runs inside the VPC with both Aurora and Cognito access
 * (AdminGetUser is in the task role for UserBootstrapService), which
 * is exactly what we need to pre-link `users` rows to the Cognito
 * subs created by `seed-cognito-users.ts`.
 *
 * Order:
 *   1. Resolve Cognito subs for each seed user via AdminGetUser
 *   2. Upsert facility (PrimedHealth Demo Hospital)
 *   3. Upsert users rows with cognito_sub set so JIT bootstrap reuses
 *      them on first login (no duplicate insert)
 *   4. Upsert 3 patients (2 portal-linked, 1 not)
 *   5. Upsert 3 cases (TKA / sleeve / CABG, varied statuses)
 *   6. Upsert workup tasks per case (mix of statuses)
 */
import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

interface SeedUser {
  pool: 'admins' | 'providers' | 'patients';
  email: string;
  given: string;
  family: string;
  role: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';
}

const USERS: readonly SeedUser[] = [
  { pool: 'admins', email: 'admin@primedhealth.dev', given: 'Avery', family: 'Admin', role: 'admin' },
  { pool: 'providers', email: 'surgeon@primedhealth.dev', given: 'Sam', family: 'Surgeon', role: 'surgeon' },
  { pool: 'providers', email: 'anesthesia@primedhealth.dev', given: 'Anna', family: 'Anesthesia', role: 'anesthesia' },
  { pool: 'providers', email: 'coordinator@primedhealth.dev', given: 'Cory', family: 'Coordinator', role: 'coordinator' },
  { pool: 'providers', email: 'allied@primedhealth.dev', given: 'Allie', family: 'Allied', role: 'allied' },
  { pool: 'patients', email: 'patient1@primedhealth.dev', given: 'Pat', family: 'Patient', role: 'patient' },
  { pool: 'patients', email: 'patient2@primedhealth.dev', given: 'River', family: 'Roe', role: 'patient' },
];

/** Deterministic UUID v5-shaped string from a stable seed. */
function deterministicUuid(seed: string): string {
  const h = createHash('sha1').update(`primedhealth-demo:${seed}`).digest('hex');
  return [
    h.substring(0, 8),
    h.substring(8, 12),
    '5' + h.substring(13, 16),
    ((parseInt(h.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.substring(18, 20),
    h.substring(20, 32),
  ].join('-');
}

interface ResolvedUser extends SeedUser {
  sub: string;
  userId: string;
}

interface PoolIds { admins: string; providers: string; patients: string }

function poolIdFor(pool: SeedUser['pool'], pools: PoolIds): string {
  if (pool === 'admins') return pools.admins;
  if (pool === 'providers') return pools.providers;
  return pools.patients;
}

async function resolveSubs(
  idp: CognitoIdentityProviderClient,
  pools: PoolIds,
): Promise<readonly ResolvedUser[]> {
  const out: ResolvedUser[] = [];
  for (const u of USERS) {
    const got = await idp.send(
      new AdminGetUserCommand({
        UserPoolId: poolIdFor(u.pool, pools),
        Username: u.email,
      }),
    );
    const sub = (got.UserAttributes ?? []).find((a) => a.Name === 'sub')?.Value;
    if (!sub) {
      throw new Error(
        `seed-demo-data: AdminGetUser returned no sub for ${u.email}. ` +
          `Run \`pnpm seed:cognito\` first to provision the Cognito users.`,
      );
    }
    out.push({ ...u, sub, userId: deterministicUuid(`user:${u.email}`) });
  }
  return out;
}

function mustFind(
  list: readonly ResolvedUser[],
  role: ResolvedUser['role'],
  email?: string,
): ResolvedUser {
  const u = list.find((x) => x.role === role && (!email || x.email === email));
  if (!u) throw new Error(`seed-demo-data: no seed user role=${role} email=${email ?? '*'}`);
  return u;
}

export interface DemoSeedSummary {
  readonly facility: number;
  readonly users: number;
  readonly patients: number;
  readonly cases: number;
  readonly tasks: number;
}

export async function seedDemoData(db: NodePgDatabase): Promise<DemoSeedSummary> {
  const region =
    process.env.COGNITO_REGION ??
    process.env.AWS_REGION ??
    process.env.AWS_DEFAULT_REGION ??
    'us-east-1';
  const pools: PoolIds = {
    admins: process.env.COGNITO_ADMINS_POOL_ID ?? '',
    providers: process.env.COGNITO_PROVIDERS_POOL_ID ?? '',
    patients: process.env.COGNITO_PATIENTS_POOL_ID ?? '',
  };
  if (!pools.admins || !pools.providers || !pools.patients) {
    throw new Error(
      'seed-demo-data: COGNITO_*_POOL_ID env vars not set. ApiStack ships them on the migrate task; outside that context, set them manually.',
    );
  }

  const idp = new CognitoIdentityProviderClient({ region });
  const resolved = await resolveSubs(idp, pools);

  const facilityId = deterministicUuid('facility:demo-hospital');
  await db.execute(sql`
    INSERT INTO facilities (id, name, timezone)
    VALUES (${facilityId}, 'PrimedHealth Demo Hospital', 'America/New_York')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
  `);

  for (const u of resolved) {
    await db.execute(sql`
      INSERT INTO users (
        id, facility_id, role, email, cognito_sub, cognito_pool,
        cognito_groups, first_name, last_name
      )
      VALUES (
        ${u.userId}, ${facilityId}, ${u.role}, ${u.email}, ${u.sub},
        ${u.pool}, ARRAY[]::text[], ${u.given}, ${u.family}
      )
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        email = EXCLUDED.email,
        cognito_sub = EXCLUDED.cognito_sub,
        cognito_pool = EXCLUDED.cognito_pool,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = now()
    `);
  }

  const surgeon = mustFind(resolved, 'surgeon');
  const coordinator = mustFind(resolved, 'coordinator');
  const patient1User = mustFind(resolved, 'patient', 'patient1@primedhealth.dev');
  const patient2User = mustFind(resolved, 'patient', 'patient2@primedhealth.dev');

  const patients = [
    {
      id: deterministicUuid('patient:p1'),
      userId: patient1User.userId as string | null,
      firstName: 'Pat', lastName: 'Patient', dob: '1968-04-12', sex: 'female', mrn: 'DEMO-001',
    },
    {
      id: deterministicUuid('patient:p2'),
      userId: patient2User.userId as string | null,
      firstName: 'River', lastName: 'Roe', dob: '1955-09-30', sex: 'male', mrn: 'DEMO-002',
    },
    {
      id: deterministicUuid('patient:p3'),
      userId: null as string | null,
      firstName: 'Jordan', lastName: 'Reyes', dob: '1972-01-22', sex: 'female', mrn: 'DEMO-003',
    },
  ];
  for (const p of patients) {
    await db.execute(sql`
      INSERT INTO patients (
        id, facility_id, user_id, first_name, last_name, dob, sex, mrn
      )
      VALUES (
        ${p.id}, ${facilityId}, ${p.userId}, ${p.firstName}, ${p.lastName},
        ${p.dob}::date, ${p.sex}, ${p.mrn}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        dob = EXCLUDED.dob,
        sex = EXCLUDED.sex,
        mrn = EXCLUDED.mrn,
        updated_at = now()
    `);
  }

  const inDays = (n: number): Date => new Date(Date.now() + n * 24 * 3600 * 1000);
  const cases = [
    {
      id: deterministicUuid('case:tka'),
      patientId: patients[0]!.id,
      procedureCode: '27447',
      procedureDescription: 'Total knee arthroplasty (right)',
      status: 'workup',
      surgeryDate: inDays(28),
      readinessScore: 35,
    },
    {
      id: deterministicUuid('case:sleeve'),
      patientId: patients[1]!.id,
      procedureCode: '43775',
      procedureDescription: 'Laparoscopic sleeve gastrectomy',
      status: 'clearance',
      surgeryDate: inDays(42),
      readinessScore: 60,
    },
    {
      id: deterministicUuid('case:cabg'),
      patientId: patients[2]!.id,
      procedureCode: '33533',
      procedureDescription: 'Coronary artery bypass graft (3-vessel)',
      status: 'referral',
      surgeryDate: inDays(56),
      readinessScore: 10,
    },
  ];
  for (const c of cases) {
    await db.execute(sql`
      INSERT INTO cases (
        id, facility_id, patient_id, surgeon_id, coordinator_id,
        procedure_code, procedure_description, status, readiness_score, surgery_date
      )
      VALUES (
        ${c.id}, ${facilityId}, ${c.patientId}, ${surgeon.userId}, ${coordinator.userId},
        ${c.procedureCode}, ${c.procedureDescription}, ${c.status}::case_status, ${c.readinessScore}, ${c.surgeryDate}
      )
      ON CONFLICT (id) DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        surgeon_id = EXCLUDED.surgeon_id,
        coordinator_id = EXCLUDED.coordinator_id,
        procedure_code = EXCLUDED.procedure_code,
        procedure_description = EXCLUDED.procedure_description,
        status = EXCLUDED.status,
        readiness_score = EXCLUDED.readiness_score,
        surgery_date = EXCLUDED.surgery_date,
        updated_at = now()
    `);
  }

  type TaskSeed = {
    title: string;
    description: string;
    assigneeRole: 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'allied' | 'patient';
    dueInDays: number;
    status: 'pending' | 'in_progress' | 'done' | 'blocked';
  };
  const taskSets: Record<string, readonly TaskSeed[]> = {
    'case:tka': [
      { title: 'Pre-op labs (CBC, BMP, PT/INR)', description: 'Standard pre-op panel.', assigneeRole: 'coordinator', dueInDays: 14, status: 'done' },
      { title: 'EKG within 30 days', description: 'Resting 12-lead.', assigneeRole: 'coordinator', dueInDays: -3, status: 'done' },
      { title: 'Anesthesia clearance review', description: 'Pre-anesthesia visit.', assigneeRole: 'anesthesia', dueInDays: 10, status: 'pending' },
      { title: 'Surgeon signs H&P', description: 'Sign the AI-drafted history & physical.', assigneeRole: 'surgeon', dueInDays: 7, status: 'pending' },
      { title: 'Patient education delivered', description: 'Pre-op prep guide + recovery checklist.', assigneeRole: 'coordinator', dueInDays: 3, status: 'in_progress' },
      { title: 'Patient signs informed consent', description: 'Consent for the planned procedure.', assigneeRole: 'patient', dueInDays: 7, status: 'pending' },
    ],
    'case:sleeve': [
      { title: 'OSA screen (STOP-BANG)', description: 'Standard for bariatric workup.', assigneeRole: 'coordinator', dueInDays: -1, status: 'done' },
      { title: 'Cardiology consult — pre-op risk', description: 'Risk-stratify cardiac comorbidities.', assigneeRole: 'allied', dueInDays: 7, status: 'pending' },
      { title: 'Nutrition counseling', description: 'Bariatric program intake visit.', assigneeRole: 'allied', dueInDays: 14, status: 'in_progress' },
      { title: 'Anesthesia clearance review', description: '', assigneeRole: 'anesthesia', dueInDays: 21, status: 'pending' },
      { title: 'Patient signs informed consent', description: '', assigneeRole: 'patient', dueInDays: 28, status: 'pending' },
    ],
    'case:cabg': [
      { title: 'Coronary angiogram review', description: '', assigneeRole: 'surgeon', dueInDays: 5, status: 'pending' },
      { title: 'Pre-op labs (CBC, BMP, coags, type & screen)', description: '', assigneeRole: 'coordinator', dueInDays: 7, status: 'pending' },
      { title: 'Anesthesia consult — high risk', description: 'RCRI ≥ 3; needs in-person.', assigneeRole: 'anesthesia', dueInDays: 14, status: 'blocked' },
      { title: 'Pulmonary consult', description: '', assigneeRole: 'allied', dueInDays: 14, status: 'pending' },
      { title: 'Patient education — CABG recovery', description: '', assigneeRole: 'coordinator', dueInDays: 21, status: 'pending' },
    ],
  };

  let taskCount = 0;
  for (const c of cases) {
    const setKey =
      c.id === deterministicUuid('case:tka')
        ? 'case:tka'
        : c.id === deterministicUuid('case:sleeve')
          ? 'case:sleeve'
          : 'case:cabg';
    const tasks = taskSets[setKey] ?? [];
    for (const t of tasks) {
      const taskId = deterministicUuid(`task:${setKey}:${t.title}`);
      const dueDate = inDays(t.dueInDays);
      const completedAt = t.status === 'done' ? inDays(t.dueInDays - 1) : null;
      const completedBy = t.status === 'done' ? coordinator.userId : null;
      await db.execute(sql`
        INSERT INTO tasks (
          id, facility_id, case_id, title, description, status,
          assignee_role, due_date, completed_at, completed_by
        )
        VALUES (
          ${taskId}, ${facilityId}, ${c.id}, ${t.title}, ${t.description},
          ${t.status}::task_status, ${t.assigneeRole}::task_assignee_role,
          ${dueDate}, ${completedAt}, ${completedBy}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          assignee_role = EXCLUDED.assignee_role,
          due_date = EXCLUDED.due_date,
          completed_at = EXCLUDED.completed_at,
          completed_by = EXCLUDED.completed_by,
          updated_at = now()
      `);
      taskCount++;
    }
  }

  return {
    facility: 1,
    users: resolved.length,
    patients: patients.length,
    cases: cases.length,
    tasks: taskCount,
  };
}
