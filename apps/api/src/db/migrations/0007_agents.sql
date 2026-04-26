-- M11.2: agents + agent_prompts + agent_runs.
-- Constitution §4 + §5.3. Append-only on agent_runs (status transitions
-- via UPDATE; never DELETE — runs are an audit/eval artifact).

CREATE TABLE "agents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp with time zone,
    "key" varchar(64) NOT NULL,
    "display_name" varchar(128) NOT NULL,
    "role" text NOT NULL,
    "default_model" varchar(64) NOT NULL,
    "default_temperature" real DEFAULT 0.2 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "agents_key_idx" ON "agents" USING btree ("key");--> statement-breakpoint

CREATE TABLE "agent_prompts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp with time zone,
    "agent_id" uuid NOT NULL,
    "version" integer NOT NULL,
    "system_prompt" text NOT NULL,
    "model" varchar(64) NOT NULL,
    "temperature" real NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "note" text,
    "author_user_id" uuid,
    CONSTRAINT "agent_prompts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "agent_prompts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

CREATE UNIQUE INDEX "agent_prompts_agent_version_idx" ON "agent_prompts" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "agent_prompts_active_idx" ON "agent_prompts" USING btree ("agent_id","is_active");--> statement-breakpoint

CREATE TABLE "agent_runs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "agent_id" uuid,
    "agent_key" varchar(64) NOT NULL,
    "prompt_version_id" uuid,
    "trigger_event" varchar(64) NOT NULL,
    "case_id" uuid,
    "facility_id" uuid,
    "status" varchar(16) DEFAULT 'queued' NOT NULL,
    "input_json" jsonb,
    "output_json" jsonb,
    "tool_calls_json" jsonb,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "total_cost_usd_micros" integer,
    "latency_ms" integer,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "error_message" text,
    "hitl_status" varchar(16) DEFAULT 'n_a' NOT NULL,
    "hitl_reviewer_id" uuid,
    "hitl_reviewed_at" timestamp with time zone,
    "hitl_note" text,
    CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "agent_runs_prompt_version_id_agent_prompts_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."agent_prompts"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "agent_runs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "agent_runs_hitl_reviewer_id_users_id_fk" FOREIGN KEY ("hitl_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX "agent_runs_agent_key_idx" ON "agent_runs" USING btree ("agent_key");--> statement-breakpoint
CREATE INDEX "agent_runs_case_idx" ON "agent_runs" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_runs_created_at_idx" ON "agent_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_hitl_idx" ON "agent_runs" USING btree ("hitl_status");
