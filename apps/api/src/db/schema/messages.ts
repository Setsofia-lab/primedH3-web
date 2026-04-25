import { boolean, index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { baseColumns } from './base';
import { cases } from './cases';
import { facilities } from './facilities';
import { users } from './users';

/**
 * Message — a single post on a case's thread.
 *
 * One implicit thread per case (no thread table needed for MVP). Each
 * post has an author user + author role at the time of writing, a body
 * (markdown-ish but we don't render any HTML — plaintext only for now),
 * and a `patientVisible` flag that controls whether the patient PWA
 * sees the post.
 *
 * Read receipts + attachments + reactions all land later (Constitution
 * §3 patient PWA UX); the schema is intentionally narrow today.
 */
export const messages = pgTable(
  'messages',
  {
    ...baseColumns,
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    /** Frozen at write time — survives later role changes. */
    authorRole: varchar('author_role', { length: 16 }).notNull(),
    body: text('body').notNull(),
    /** When true, the patient sees this message in their PWA thread. */
    patientVisible: boolean('patient_visible').notNull().default(false),
  },
  (table) => [
    index('messages_case_idx').on(table.caseId),
    index('messages_facility_idx').on(table.facilityId),
    index('messages_author_idx').on(table.authorUserId),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
