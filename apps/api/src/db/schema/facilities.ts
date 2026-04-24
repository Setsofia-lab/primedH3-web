import { pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { baseColumns } from './base';

/**
 * Facility — tenant root. Every clinical row in the app carries
 * `facilityId` for isolation.
 *
 * `athenaPracticeId` maps to Athena's practice identifier (see
 * Constitution §12 locked decisions: 1128700 / 195900 / 80000 for
 * our sandbox).
 */
export const facilities = pgTable('facilities', {
  ...baseColumns,
  name: varchar('name', { length: 256 }).notNull(),
  athenaPracticeId: text('athena_practice_id'),
  timezone: text('timezone').notNull().default('America/New_York'),
});

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
