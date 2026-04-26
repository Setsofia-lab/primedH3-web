/**
 * seed-agents.ts — idempotent insert of the 10 agents from
 * Constitution §4 into the `agents` table. Re-runnable; uses
 * INSERT ... ON CONFLICT (key) DO UPDATE so model defaults can be
 * tweaked here and re-applied without manual SQL.
 *
 * Run via the migrate ECS task in the same way as drizzle migrations:
 *   AWS_PROFILE=primedhealth-dev pnpm --filter @primedhealth/api seed:agents
 *
 * Or, in CI, after migrations land. Safe to run anytime.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { resolveRuntimeSecrets } from '../src/config/secret-resolver';

interface Seed {
  key: string;
  displayName: string;
  role: string;
  defaultModel: string;
  defaultTemperature: number;
}

const SEEDS: Seed[] = [
  {
    key: 'intake_orchestrator',
    displayName: 'IntakeOrchestrator',
    role: 'Build the perioperative workup plan from procedure code + patient history',
    defaultModel: 'anthropic.claude-sonnet-4-7',
    defaultTemperature: 0.2,
  },
  {
    key: 'risk_screening',
    displayName: 'RiskScreeningAgent',
    role: 'NSQIP-style risk screen across 100+ conditions',
    defaultModel: 'anthropic.claude-opus-4-7',
    defaultTemperature: 0.1,
  },
  {
    key: 'anesthesia_clearance',
    displayName: 'AnesthesiaClearanceAgent',
    role: 'Pre-anesthesia note + ASA / RCRI / STOP-BANG',
    defaultModel: 'anthropic.claude-opus-4-7',
    defaultTemperature: 0.1,
  },
  {
    key: 'referral',
    displayName: 'ReferralAgent',
    role: 'Draft and send specialty referrals with context pack',
    defaultModel: 'anthropic.claude-sonnet-4-7',
    defaultTemperature: 0.2,
  },
  {
    key: 'scheduling',
    displayName: 'SchedulingAgent',
    role: 'Find common slots across providers + patient via calendar MCP',
    defaultModel: 'anthropic.claude-haiku-4-5',
    defaultTemperature: 0.0,
  },
  {
    key: 'patient_comms',
    displayName: 'PatientCommsAgent',
    role: 'Handle patient messages, answer FAQs, escalate clinical Qs',
    defaultModel: 'anthropic.claude-sonnet-4-7',
    defaultTemperature: 0.3,
  },
  {
    key: 'pre_hab',
    displayName: 'PreHabAgent',
    role: 'Prescribe and track pre-hab regimen, nudge adherence',
    defaultModel: 'anthropic.claude-haiku-4-5',
    defaultTemperature: 0.2,
  },
  {
    key: 'documentation',
    displayName: 'DocumentationAgent',
    role: 'Draft H&Ps and op-notes from chart context',
    defaultModel: 'anthropic.claude-sonnet-4-7',
    defaultTemperature: 0.2,
  },
  {
    key: 'task_tracker',
    displayName: 'TaskTrackerAgent',
    role: 'Maintain the coordinator Kanban + Asana mirror',
    defaultModel: 'anthropic.claude-haiku-4-5',
    defaultTemperature: 0.0,
  },
  {
    key: 'readiness',
    displayName: 'ReadinessAgent',
    role: 'Continuously recompute the patient-facing readiness score',
    defaultModel: 'anthropic.claude-sonnet-4-7',
    defaultTemperature: 0.1,
  },
];

async function main(): Promise<void> {
  await resolveRuntimeSecrets();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const pool = new Pool({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 2,
  });
  const db = drizzle(pool);

  for (const s of SEEDS) {
    await db.execute(sql`
      INSERT INTO agents (key, display_name, role, default_model, default_temperature, enabled)
      VALUES (${s.key}, ${s.displayName}, ${s.role}, ${s.defaultModel}, ${s.defaultTemperature}, true)
      ON CONFLICT (key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        default_model = EXCLUDED.default_model,
        default_temperature = EXCLUDED.default_temperature,
        updated_at = now()
    `);
  }

  // eslint-disable-next-line no-console
  console.log(`[seed-agents] upserted ${SEEDS.length} agents`);
  await pool.end();
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed-agents failed:', err);
  process.exit(1);
});
