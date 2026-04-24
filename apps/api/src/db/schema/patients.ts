import { date, index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { athenaMirrorColumns, baseColumns } from './base';
import { facilities } from './facilities';
import { users } from './users';

/**
 * Patient — the clinical subject. Linked 1:1 to a User when the patient
 * has an app account (magic-link PWA).
 *
 * Architecturally a **read-only mirror** of Athena's FHIR Patient (see
 * ADR 0002). `athenaResourceId` carries the FHIR id (e.g.
 * `a-1128700.E-14914`); demographics are denormalized here for fast
 * query without an Athena round-trip. `athenaLastSyncAt` tells you how
 * stale the cache is — callers can request a re-pull via the hydration
 * service when they need fresher data.
 *
 * PHI note: name, DOB, MRN, and Athena resource id are all PHI. No PHI
 * in logs, metrics, or non-HIPAA-BAA analytics (Constitution §7).
 */
export const patients = pgTable(
  'patients',
  {
    ...baseColumns,
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    userId: uuid('user_id').references(() => users.id),
    ...athenaMirrorColumns,
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dob: date('dob').notNull(),
    sex: varchar('sex', { length: 16 }),
    mrn: varchar('mrn', { length: 64 }),
  },
  (table) => [
    index('patients_facility_idx').on(table.facilityId),
    // One row per (facility, Athena FHIR id) pair so a re-sync upserts
    // cleanly. Nullable values allowed — not all patients originate in
    // Athena (e.g. self-registered via the PWA before EHR hand-off).
    uniqueIndex('patients_facility_athena_idx').on(
      table.facilityId,
      table.athenaResourceId,
    ),
    uniqueIndex('patients_facility_mrn_idx').on(table.facilityId, table.mrn),
  ],
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
