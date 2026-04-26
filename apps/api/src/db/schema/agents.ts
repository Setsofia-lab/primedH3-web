import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './base';
import { cases } from './cases';
import { users } from './users';

/**
 * Agent registry. One row per agent kind defined in Constitution §4
 * (intake_orchestrator, risk_screening, etc.). The runtime looks up
 * the active prompt version via `agent_prompts.is_active`.
 *
 * Seeded by a one-shot script after migration (so we don't need a data
 * migration that drifts).
 */
export const agents = pgTable(
  'agents',
  {
    ...baseColumns,
    /** Stable enum-like key that messages reference (e.g. 'intake_orchestrator'). */
    key: varchar('key', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 128 }).notNull(),
    role: text('role').notNull(),
    defaultModel: varchar('default_model', { length: 64 }).notNull(),
    defaultTemperature: real('default_temperature').notNull().default(0.2),
    enabled: boolean('enabled').notNull().default(true),
  },
  (table) => [uniqueIndex('agents_key_idx').on(table.key)],
);
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

/**
 * Agent prompt versions. One row per (agent, version). The runtime
 * uses the row marked `is_active = true`; admins promote new versions
 * via the prompt editor. We never delete — versions are immutable for
 * audit + eval reproducibility.
 */
export const agentPrompts = pgTable(
  'agent_prompts',
  {
    ...baseColumns,
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    model: varchar('model', { length: 64 }).notNull(),
    temperature: real('temperature').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    note: text('note'),
    authorUserId: uuid('author_user_id').references(() => users.id),
  },
  (table) => [
    uniqueIndex('agent_prompts_agent_version_idx').on(table.agentId, table.version),
    index('agent_prompts_active_idx').on(table.agentId, table.isActive),
  ],
);
export type AgentPrompt = typeof agentPrompts.$inferSelect;
export type NewAgentPrompt = typeof agentPrompts.$inferInsert;

/**
 * Agent runs — the audit log of every model invocation.
 *
 * Lifecycle:
 *   queued (api emitted SQS message, run row pre-created with id) →
 *   running (worker picked up the message) →
 *   succeeded / failed
 *
 * Clinical recommendations end with `hitl_status = 'pending'`; HITL
 * UI flips to `approved` / `declined` when a human reviews.
 */
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),

    agentId: uuid('agent_id').references(() => agents.id),
    /** Denormalised for fast filtering ('intake_orchestrator' etc.). */
    agentKey: varchar('agent_key', { length: 64 }).notNull(),
    promptVersionId: uuid('prompt_version_id').references(() => agentPrompts.id),

    triggerEvent: varchar('trigger_event', { length: 64 }).notNull(),
    caseId: uuid('case_id').references(() => cases.id),
    facilityId: uuid('facility_id'),

    status: varchar('status', { length: 16 }).notNull().default('queued'),

    /** Free-form (validated by agent-specific zod schemas at write time). */
    inputJson: jsonb('input_json'),
    outputJson: jsonb('output_json'),
    toolCallsJson: jsonb('tool_calls_json'),

    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    /** USD * 1e6. 0 for stub responses. */
    totalCostUsdMicros: integer('total_cost_usd_micros'),
    latencyMs: integer('latency_ms'),

    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),

    /** 'n_a' for non-clinical recs, 'pending'/'approved'/'declined' otherwise. */
    hitlStatus: varchar('hitl_status', { length: 16 }).notNull().default('n_a'),
    hitlReviewerId: uuid('hitl_reviewer_id').references(() => users.id),
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
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
