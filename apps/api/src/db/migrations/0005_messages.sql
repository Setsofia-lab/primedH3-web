-- M7.7: per-case message threads (Constitution §3 in-app messaging).

CREATE TABLE "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp with time zone,
    "facility_id" uuid NOT NULL,
    "case_id" uuid NOT NULL,
    "author_user_id" uuid NOT NULL,
    "author_role" varchar(16) NOT NULL,
    "body" text NOT NULL,
    "patient_visible" boolean DEFAULT false NOT NULL,
    CONSTRAINT "messages_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "messages_case_idx" ON "messages" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "messages_facility_idx" ON "messages" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_user_id");
