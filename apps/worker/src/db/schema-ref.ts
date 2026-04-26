/**
 * Drizzle table refs for the worker. Mirrors the subset of api's
 * schema the worker actually writes to. Keep in lockstep with
 * apps/api/src/db/schema/*.ts.
 *
 * (Yes, duplication. The cleaner move is to extract the schema to a
 * shared package — we do that when the worker outgrows two tables.)
 */
import {
  index,
  integer,
  jsonb,
  pgTable,
  pgEnum,
  text,
  timestamp,
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
