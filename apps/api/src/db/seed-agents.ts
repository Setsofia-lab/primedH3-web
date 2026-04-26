/**
 * Idempotent seed of the 10 agents from Constitution §4 into the
 * `agents` table. Re-runnable; uses INSERT ... ON CONFLICT (key) DO
 * UPDATE so model defaults can be tweaked here and re-applied without
 * manual SQL.
 *
 * Invoked from migrate.ts after migrations land, so every deploy
 * keeps the registry in sync with the constitution.
 */
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

interface Seed {
  key: string;
  displayName: string;
  role: string;
  defaultModel: string;
  defaultTemperature: number;
  /**
   * Initial v1 system prompt for the prompt registry. Optional during
   * agent rollout — agents whose .agent.ts file already has a hardcoded
   * SYSTEM_PROMPT can ship without a registry row and the worker falls
   * back. Included once a stable prompt is worth versioning.
   */
  initialPrompt?: string;
}

const INTAKE_ORCHESTRATOR_PROMPT_V1 = `You are PrimedHealth's IntakeOrchestrator agent. Your job is to
generate a perioperative workup checklist for a surgical case.

Inputs you'll receive (in the user message as JSON):
  - procedureCode: CPT or null
  - procedureDescription: string or null
  - patient: { dob, sex, mrn? }
  - facility: { name, timezone }

Output a JSON object (and ONLY JSON) of the form:
{
  "tasks": [
    {
      "title": "...",                          // <= 256 chars
      "description": "...",                    // optional, <= 4000
      "assigneeRole": "coordinator" | "surgeon" | "anesthesia" |
                       "allied" | "patient" | "admin",
      "dueInDays": <integer 0..180>            // optional
    },
    ...
  ],
  "rationale": "1-3 sentences on why this list fits this case"
}

Rules:
  - Always include: pre-op labs, EKG, anesthesia clearance, surgeon
    H&P sign-off, patient education, informed consent.
  - Add procedure-specific items where appropriate (e.g. cardiology
    consult for ASA >=3 / cardiac procedures, OSA screening for
    bariatric, MRSA screen for orthopedic implants).
  - Never include items that require write-back to Athena (we're
    read-only against Athena per ADR 0002).
  - Never recommend administering medications or scheduling surgery —
    those need a human in the loop.
  - Keep the list under 12 items.
  - Use sensible due-day offsets relative to surgery, not creation.`;

const SEEDS: Seed[] = [
  {
    key: 'intake_orchestrator',
    displayName: 'IntakeOrchestrator',
    role: 'Build the perioperative workup plan from procedure code + patient history',
    defaultModel: 'anthropic.claude-sonnet-4-7',
    defaultTemperature: 0.2,
    initialPrompt: INTAKE_ORCHESTRATOR_PROMPT_V1,
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

export async function seedAgents(
  db: NodePgDatabase,
): Promise<{ agents: number; prompts: number }> {
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

  // Bootstrap a v1 prompt for any agent that ships one. Skip if the
  // agent already has at least one version — admins own the registry
  // after the first deploy.
  let promptsSeeded = 0;
  for (const s of SEEDS) {
    if (!s.initialPrompt) continue;
    const inserted = await db.execute(sql`
      WITH agent_row AS (SELECT id FROM agents WHERE key = ${s.key} LIMIT 1)
      INSERT INTO agent_prompts (
        agent_id, version, system_prompt, model, temperature, is_active, note
      )
      SELECT
        agent_row.id, 1, ${s.initialPrompt}, ${s.defaultModel}, ${s.defaultTemperature},
        true, 'seeded with agent registry'
      FROM agent_row
      WHERE NOT EXISTS (
        SELECT 1 FROM agent_prompts WHERE agent_id = agent_row.id
      )
      RETURNING id
    `);
    promptsSeeded += inserted.rowCount ?? 0;
  }
  return { agents: SEEDS.length, prompts: promptsSeeded };
}
