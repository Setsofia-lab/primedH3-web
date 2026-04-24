import { pgTable, text, uniqueIndex, uuid, varchar, index } from 'drizzle-orm/pg-core';
import { baseColumns, userRoleEnum } from './base';
import { facilities } from './facilities';

/**
 * User — any person with login access. Role determines which surfaces
 * they see (admin dashboard, surgeon cockpit, patient PWA, etc.).
 *
 * `cognitoSub` links to the user's Cognito identity. Patients live in
 * their own Cognito pool; providers + admins live in others — the pool
 * isn't stored here because any authenticated user has exactly one sub
 * and we resolve the pool from role at auth time.
 */
export const users = pgTable(
  'users',
  {
    ...baseColumns,
    facilityId: uuid('facility_id').references(() => facilities.id),
    role: userRoleEnum('role').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    cognitoSub: varchar('cognito_sub', { length: 64 }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: varchar('phone', { length: 32 }),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_cognito_sub_idx').on(table.cognitoSub),
    index('users_facility_role_idx').on(table.facilityId, table.role),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
