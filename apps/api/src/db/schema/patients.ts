import { date, index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { baseColumns } from './base';
import { facilities } from './facilities';
import { users } from './users';

/**
 * Patient — the clinical subject. Linked 1:1 to a User when the patient
 * has an app account (magic-link PWA). We also track an Athena patient
 * id so agent writes route back to the EHR.
 *
 * PHI note: name, DOB, and Athena ID are PHI. No PHI in logs, metrics,
 * or non-HIPAA-BAA analytics (Constitution §7).
 */
export const patients = pgTable(
  'patients',
  {
    ...baseColumns,
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    userId: uuid('user_id').references(() => users.id),
    athenaPatientId: text('athena_patient_id'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dob: date('dob').notNull(),
    sex: varchar('sex', { length: 16 }),
    mrn: varchar('mrn', { length: 64 }),
  },
  (table) => [
    index('patients_facility_idx').on(table.facilityId),
    uniqueIndex('patients_facility_athena_idx').on(table.facilityId, table.athenaPatientId),
    uniqueIndex('patients_facility_mrn_idx').on(table.facilityId, table.mrn),
  ],
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
