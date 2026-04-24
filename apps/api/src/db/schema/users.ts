import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns, userRoleEnum } from './base';
import { facilities } from './facilities';

/**
 * User — any person with login access. Role determines which surfaces
 * they see (admin dashboard, surgeon cockpit, patient PWA, etc.).
 *
 * `cognitoSub` is the canonical link to a Cognito identity. `cognitoPool`
 * tells us which of our three pools they live in (admins / providers /
 * patients). `cognitoGroups` mirrors the cognito:groups claim so the
 * coordinator board can filter "who's a surgeon" without re-asking
 * Cognito for every render.
 *
 * Rows are auto-created on first authenticated request (see
 * UserBootstrapInterceptor) so every JWT-authenticated caller has a
 * `users` row before any handler reads from one.
 */
export const users = pgTable(
  'users',
  {
    ...baseColumns,
    facilityId: uuid('facility_id').references(() => facilities.id),
    role: userRoleEnum('role').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    cognitoSub: varchar('cognito_sub', { length: 64 }),
    cognitoPool: varchar('cognito_pool', { length: 16 }),
    cognitoGroups: text('cognito_groups').array().notNull().default([]),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: varchar('phone', { length: 32 }),
    invitedAt: timestamp('invited_at', { withTimezone: true, mode: 'date' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_cognito_sub_idx').on(table.cognitoSub),
    index('users_facility_role_idx').on(table.facilityId, table.role),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
