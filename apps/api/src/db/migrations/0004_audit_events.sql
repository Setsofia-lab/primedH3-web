-- M8a: audit events — append-only HIPAA log (Constitution §7).
-- Insert-only by design; no UPDATE path, no soft-delete.

CREATE TYPE "public"."audit_action" AS ENUM(
  'create','update','delete','read','login','invite','hydrate','sign'
);--> statement-breakpoint

CREATE TABLE "audit_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
    "actor_user_id" uuid,
    "actor_email" varchar(320),
    "actor_role" varchar(16),
    "actor_pool" varchar(16),
    "action" "audit_action" NOT NULL,
    "resource_type" varchar(32) NOT NULL,
    "resource_id" text,
    "target_facility_id" uuid,
    "request_id" varchar(64),
    "ip" varchar(64),
    "user_agent" text,
    "before_json" jsonb,
    "after_json" jsonb,
    "note" text,
    CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX "audit_actor_idx" ON "audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_occurred_at_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_facility_idx" ON "audit_events" USING btree ("target_facility_id");
