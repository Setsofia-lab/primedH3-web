-- M5 Athena integration: add read-only mirror columns to patients,
-- create the appointments table mirrored from FHIR Appointment.
-- See ADR 0002 (docs/ADRs/0002-athena-read-only-integration.md).

-- --- patients: replace single athena_patient_id with the shared mirror columns ---
DROP INDEX IF EXISTS "patients_facility_athena_idx";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN IF EXISTS "athena_patient_id";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "source" varchar(16) DEFAULT 'primedhealth' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "athena_resource_id" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "athena_practice_id" varchar(16);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "athena_version" varchar(64);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "athena_last_sync_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "patients_facility_athena_idx" ON "patients" USING btree ("facility_id","athena_resource_id");--> statement-breakpoint

-- --- appointments enum + table ---
CREATE TYPE "public"."appointment_status" AS ENUM('proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist');--> statement-breakpoint
CREATE TABLE "appointments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp with time zone,
    "facility_id" uuid NOT NULL,
    "patient_id" uuid,
    "provider_id" uuid,
    "source" varchar(16) DEFAULT 'primedhealth' NOT NULL,
    "athena_resource_id" text,
    "athena_practice_id" varchar(16),
    "athena_version" varchar(64),
    "athena_last_sync_at" timestamp with time zone,
    "status" "appointment_status" DEFAULT 'proposed' NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "service_type" text,
    "location_hint" text,
    "note" text,
    "cancel_reason" varchar(256),
    CONSTRAINT "appointments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "appointments_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "appointments_facility_idx" ON "appointments" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointments_starts_at_idx" ON "appointments" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_facility_athena_idx" ON "appointments" USING btree ("facility_id","athena_resource_id");
