-- M7.8: per-case documents (S3-backed). Binary lives in S3; this row
-- is the canonical metadata + access-control anchor.

CREATE TYPE "public"."document_kind" AS ENUM(
  'consent','lab','imaging','history','discharge','education','other'
);--> statement-breakpoint

CREATE TABLE "documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp with time zone,
    "facility_id" uuid NOT NULL,
    "case_id" uuid NOT NULL,
    "name" varchar(256) NOT NULL,
    "content_type" varchar(128) NOT NULL,
    "size_bytes" integer,
    "s3_key" text NOT NULL,
    "kind" "document_kind" DEFAULT 'other' NOT NULL,
    "patient_visible" boolean DEFAULT false NOT NULL,
    "uploaded_by_user_id" uuid NOT NULL,
    CONSTRAINT "documents_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX "documents_case_idx" ON "documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "documents_facility_idx" ON "documents" USING btree ("facility_id");
