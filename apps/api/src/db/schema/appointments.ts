import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { appointmentStatusEnum, athenaMirrorColumns, baseColumns } from './base';
import { facilities } from './facilities';
import { patients } from './patients';
import { users } from './users';

/**
 * Appointment — read-only mirror of Athena's FHIR Appointment (per
 * ADR 0002). We hydrate from Athena's Event Notifications
 * (`appointment.scheduled` / `appointment.updated` / `.cancelled`)
 * so coordinators see the patient's surgery date + pre-op visits in
 * real time without polling.
 *
 * Schema mirrors the subset of Athena's `ah-appointment` profile we
 * surface to agents + UI. The full FHIR payload is cached as JSON in
 * the documents table if needed — not here.
 *
 * This table is NOT the authoritative record for appointments; Athena
 * is. Edits by the coordinator happen in Athena (or via athenaOne
 * Scheduling once those scopes are granted); we pick up the change
 * via the next event.
 */
export const appointments = pgTable(
  'appointments',
  {
    ...baseColumns,
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    patientId: uuid('patient_id').references(() => patients.id),
    providerId: uuid('provider_id').references(() => users.id),
    ...athenaMirrorColumns,
    status: appointmentStatusEnum('status').notNull().default('proposed'),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
    serviceType: text('service_type'),
    locationHint: text('location_hint'),
    /** Free-text description from Athena's `comment` / note extension. */
    note: text('note'),
    /** For cancellations — FHIR cancelationReason.text. */
    cancelReason: varchar('cancel_reason', { length: 256 }),
  },
  (table) => [
    index('appointments_facility_idx').on(table.facilityId),
    index('appointments_patient_idx').on(table.patientId),
    index('appointments_starts_at_idx').on(table.startsAt),
    uniqueIndex('appointments_facility_athena_idx').on(
      table.facilityId,
      table.athenaResourceId,
    ),
  ],
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
