import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns, caseStatusEnum } from './base';
import { facilities } from './facilities';
import { patients } from './patients';
import { users } from './users';

/**
 * Case — a single surgical episode for a patient. One source of truth
 * across surgeon cockpit, anesthesia queue, coordinator board, and the
 * patient PWA.
 *
 * `readinessScore` is the agent-computed 0–100 score (see §4 Agent 10,
 * ReadinessAgent). It's denormalized here for fast UI reads; the agent
 * run history in `agent_runs` retains the compute trail.
 */
export const cases = pgTable(
  'cases',
  {
    ...baseColumns,
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    surgeonId: uuid('surgeon_id').references(() => users.id),
    coordinatorId: uuid('coordinator_id').references(() => users.id),

    procedureCode: varchar('procedure_code', { length: 32 }),
    procedureDescription: text('procedure_description'),

    status: caseStatusEnum('status').notNull().default('referral'),
    readinessScore: integer('readiness_score'),
    surgeryDate: timestamp('surgery_date', { withTimezone: true, mode: 'date' }),
    clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('cases_facility_status_idx').on(table.facilityId, table.status),
    index('cases_surgeon_idx').on(table.surgeonId),
    index('cases_coordinator_idx').on(table.coordinatorId),
    index('cases_patient_idx').on(table.patientId),
  ],
);

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
