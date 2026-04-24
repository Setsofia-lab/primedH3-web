import { pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

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
