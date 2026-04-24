CREATE TYPE "public"."case_status" AS ENUM('referral', 'workup', 'clearance', 'pre_hab', 'ready', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied', 'patient');--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" varchar(256) NOT NULL,
	"athena_practice_id" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"facility_id" uuid,
	"role" "user_role" NOT NULL,
	"email" varchar(320) NOT NULL,
	"cognito_sub" varchar(64),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"facility_id" uuid NOT NULL,
	"user_id" uuid,
	"athena_patient_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" date NOT NULL,
	"sex" varchar(16),
	"mrn" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"facility_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"surgeon_id" uuid,
	"coordinator_id" uuid,
	"procedure_code" varchar(32),
	"procedure_description" text,
	"status" "case_status" DEFAULT 'referral' NOT NULL,
	"readiness_score" integer,
	"surgery_date" timestamp with time zone,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_surgeon_id_users_id_fk" FOREIGN KEY ("surgeon_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_coordinator_id_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_cognito_sub_idx" ON "users" USING btree ("cognito_sub");--> statement-breakpoint
CREATE INDEX "users_facility_role_idx" ON "users" USING btree ("facility_id","role");--> statement-breakpoint
CREATE INDEX "patients_facility_idx" ON "patients" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_facility_athena_idx" ON "patients" USING btree ("facility_id","athena_patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_facility_mrn_idx" ON "patients" USING btree ("facility_id","mrn");--> statement-breakpoint
CREATE INDEX "cases_facility_status_idx" ON "cases" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "cases_surgeon_idx" ON "cases" USING btree ("surgeon_id");--> statement-breakpoint
CREATE INDEX "cases_coordinator_idx" ON "cases" USING btree ("coordinator_id");--> statement-breakpoint
CREATE INDEX "cases_patient_idx" ON "cases" USING btree ("patient_id");