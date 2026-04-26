/**
 * Drizzle table refs for the worker. Mirrors the subset of api's
 * schema the worker actually writes to. Keep in lockstep with
 * apps/api/src/db/schema/*.ts.
 *
 * (Yes, duplication. The cleaner move is to extract the schema to a
 * shared package — we do that when the worker outgrows two tables.)
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  pgEnum,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ----- enums (must match the api's CREATE TYPE statements exactly) ---

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'done',
  'blocked',
]);

export const taskAssigneeRoleEnum = pgEnum('task_assignee_role', [
  'admin',
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied',
  'patient',
]);

// ----- tasks (subset — agent inserts go here on intake) --------------

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  facilityId: uuid('facility_id').notNull(),
  caseId: uuid('case_id').notNull(),
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('pending'),
  assigneeRole: taskAssigneeRoleEnum('assignee_role').notNull(),
  assigneeUserId: uuid('assignee_user_id'),
  dueDate: timestamp('due_date', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  completedBy: uuid('completed_by'),
});

// ----- cases (read tasks + write readiness_score) --------------------

export const cases = pgTable('cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  facilityId: uuid('facility_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  surgeonId: uuid('surgeon_id'),
  coordinatorId: uuid('coordinator_id'),
  procedureCode: varchar('procedure_code', { length: 32 }),
  procedureDescription: text('procedure_description'),
  status: varchar('status', { length: 32 }).notNull().default('referral'),
  readinessScore: integer('readiness_score'),
  surgeryDate: timestamp('surgery_date', { withTimezone: true, mode: 'date' }),
  clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'date' }),
});

// ----- agents + agent_prompts (read-only for the worker) -------------

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    key: varchar('key', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 128 }).notNull(),
    role: text('role').notNull(),
    defaultModel: varchar('default_model', { length: 64 }).notNull(),
    defaultTemperature: real('default_temperature').notNull().default(0.2),
    enabled: boolean('enabled').notNull().default(true),
  },
  (table) => [uniqueIndex('agents_key_idx').on(table.key)],
);

export const agentPrompts = pgTable(
  'agent_prompts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    agentId: uuid('agent_id').notNull(),
    version: integer('version').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    model: varchar('model', { length: 64 }).notNull(),
    temperature: real('temperature').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    note: text('note'),
    authorUserId: uuid('author_user_id'),
  },
  (table) => [
    uniqueIndex('agent_prompts_agent_version_idx').on(table.agentId, table.version),
    index('agent_prompts_active_idx').on(table.agentId, table.isActive),
  ],
);

// ----- agent_runs (the worker's primary write target) ----------------

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    agentId: uuid('agent_id'),
    agentKey: varchar('agent_key', { length: 64 }).notNull(),
    promptVersionId: uuid('prompt_version_id'),
    triggerEvent: varchar('trigger_event', { length: 64 }).notNull(),
    caseId: uuid('case_id'),
    facilityId: uuid('facility_id'),
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    inputJson: jsonb('input_json'),
    outputJson: jsonb('output_json'),
    toolCallsJson: jsonb('tool_calls_json'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalCostUsdMicros: integer('total_cost_usd_micros'),
    latencyMs: integer('latency_ms'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),
    hitlStatus: varchar('hitl_status', { length: 16 }).notNull().default('n_a'),
    hitlReviewerId: uuid('hitl_reviewer_id'),
    hitlReviewedAt: timestamp('hitl_reviewed_at', { withTimezone: true, mode: 'date' }),
    hitlNote: text('hitl_note'),
  },
  (table) => [
    index('agent_runs_agent_key_idx').on(table.agentKey),
    index('agent_runs_case_idx').on(table.caseId),
    index('agent_runs_status_idx').on(table.status),
    index('agent_runs_created_at_idx').on(table.createdAt),
    index('agent_runs_hitl_idx').on(table.hitlStatus),
  ],
);
