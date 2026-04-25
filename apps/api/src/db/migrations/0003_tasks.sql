-- M7.5: per-case workup tasks (Constitution §3.4 coordinator board).
-- One row per actionable item attached to a case; owned by an app role
-- (and optionally a specific user). M9 auto-fills these from agents.

CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'done', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."task_assignee_role" AS ENUM('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied', 'patient');--> statement-breakpoint

CREATE TABLE "tasks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp with time zone,
    "facility_id" uuid NOT NULL,
    "case_id" uuid NOT NULL,
    "title" varchar(256) NOT NULL,
    "description" text,
    "status" "task_status" DEFAULT 'pending' NOT NULL,
    "assignee_role" "task_assignee_role" NOT NULL,
    "assignee_user_id" uuid,
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "completed_by" uuid,
    CONSTRAINT "tasks_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX "tasks_case_idx" ON "tasks" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "tasks_facility_idx" ON "tasks" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_user_idx" ON "tasks" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_role_status_idx" ON "tasks" USING btree ("assignee_role","status");
