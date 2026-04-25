import { pgEnum, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Shared columns for every entity in §6.
 *
 * - id: uuid (v4) primary key
 * - createdAt, updatedAt: server timestamps with millisecond precision
 * - createdBy: user id of creator (nullable for system-seeded rows)
 * - deletedAt: soft-delete marker; queries should always filter deletedAt IS NULL
 */
export const baseColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  createdBy: uuid('created_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
} as const;

/**
 * Columns added to every entity whose authoritative record lives in
 * Athena (see ADR 0002 — read-only cache architecture).
 *
 * - source: 'athena' when the row mirrors an Athena resource; 'primedhealth' when we own it.
 * - athenaResourceId: the FHIR id (e.g. `a-1128700.E-14914` for Patient).
 * - athenaPracticeId: numeric Athena practice id (§12 dev IDs: 1128700 / 195900 / 80000).
 * - athenaVersion: FHIR `meta.versionId` — used for optimistic concurrency on re-syncs.
 * - athenaLastSyncAt: timestamp of the last successful read from Athena.
 */
export const athenaMirrorColumns = {
  source: varchar('source', { length: 16 }).notNull().default('primedhealth'),
  athenaResourceId: text('athena_resource_id'),
  athenaPracticeId: varchar('athena_practice_id', { length: 16 }),
  athenaVersion: varchar('athena_version', { length: 64 }),
  athenaLastSyncAt: timestamp('athena_last_sync_at', { withTimezone: true, mode: 'date' }),
} as const;

/** User role enum — Constitution §1.4 primary users. */
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied', // pre-hab / PT / specialty referrals
  'patient',
]);

/** Case lifecycle — Constitution §3.4 coordinator board. */
export const caseStatusEnum = pgEnum('case_status', [
  'referral',
  'workup',
  'clearance',
  'pre_hab',
  'ready',
  'completed',
  'cancelled',
]);

/** Per-case workup task lifecycle. Used by IntakeOrchestrator + the
 * coordinator board (Constitution §3.4 + §4 Agent 8 TaskTracker). */
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'done',
  'blocked',
]);

/** Which app role can fulfil this task. `assignee_user_id` (when set)
 * narrows it to a specific person; otherwise any user with that role
 * at the facility can pick it up. */
export const taskAssigneeRoleEnum = pgEnum('task_assignee_role', [
  'admin',
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied',
  'patient',
]);

/** Appointment lifecycle — mirrors FHIR Appointment.status (R4). */
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'proposed',
  'pending',
  'booked',
  'arrived',
  'fulfilled',
  'cancelled',
  'noshow',
  'entered-in-error',
  'checked-in',
  'waitlist',
]);
