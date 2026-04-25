import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditActionEnum } from './base';
import { users } from './users';

/**
 * Audit event — append-only log of every PHI-touching mutation.
 *
 * The shape is deliberately denormalised: actor identity is captured
 * verbatim at the moment of the action (so a later role-change doesn't
 * rewrite history), and `before_json` / `after_json` capture the row's
 * state pre/post change for diff inspection.
 *
 * Indexed for the typical admin-audit page query patterns:
 *   - by actor (who did this user touch?)
 *   - by resource (everything that happened to case X)
 *   - by time (last 24h / last week)
 *
 * Insert-only by design — there's no UPDATE path. Soft-deletes are
 * inappropriate here (an audit trail you can edit isn't an audit trail);
 * retention policy lives in §7 and lands with M10.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),

    // Actor — who did the thing.
    actorUserId: uuid('actor_user_id').references(() => users.id),
    actorEmail: varchar('actor_email', { length: 320 }),
    actorRole: varchar('actor_role', { length: 16 }),
    actorPool: varchar('actor_pool', { length: 16 }),

    // Verb + target.
    action: auditActionEnum('action').notNull(),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    resourceId: text('resource_id'),
    targetFacilityId: uuid('target_facility_id'),

    // Diagnostic context.
    requestId: varchar('request_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),

    // State at the time. Both nullable — a `read` doesn't mutate, a
    // `create` has no before, a `delete` has no after.
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),

    // Free-form note (optional).
    note: text('note'),
  },
  (table) => [
    index('audit_actor_idx').on(table.actorUserId),
    index('audit_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_occurred_at_idx').on(table.occurredAt),
    index('audit_facility_idx').on(table.targetFacilityId),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
