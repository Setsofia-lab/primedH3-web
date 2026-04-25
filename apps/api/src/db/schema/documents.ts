import { boolean, index, integer, pgTable, text, varchar, uuid } from 'drizzle-orm/pg-core';
import { baseColumns, documentKindEnum } from './base';
import { cases } from './cases';
import { facilities } from './facilities';
import { users } from './users';

/**
 * Document — a file attached to a case.
 *
 * Files live in S3; we never store binary in the DB. The `s3Key` is
 * the canonical reference; presigned URLs are minted at read/upload
 * time (5-minute TTL).
 *
 * `patientVisible` controls whether the patient PWA's education feed
 * shows the doc. `kind` drives the default visibility (education =
 * always visible; consent = visible by default; lab/history hidden
 * unless explicit).
 */
export const documents = pgTable(
  'documents',
  {
    ...baseColumns,
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 256 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    sizeBytes: integer('size_bytes'),
    s3Key: text('s3_key').notNull(),
    kind: documentKindEnum('kind').notNull().default('other'),
    patientVisible: boolean('patient_visible').notNull().default(false),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index('documents_case_idx').on(table.caseId),
    index('documents_facility_idx').on(table.facilityId),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
