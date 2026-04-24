-- M7.3: extend users with Cognito linkage + presence tracking.
--
-- Adds:
--   cognito_pool      — one of admins | providers | patients
--   cognito_groups    — text[], mirrors the JWT cognito:groups claim
--   invited_at        — when an admin sent the invite (null for self-bootstraps)
--   last_seen_at      — updated by the user-bootstrap interceptor on each request
--
-- Existing rows (none yet in dev) get default empty groups + nulls.

ALTER TABLE "users" ADD COLUMN "cognito_pool" varchar(16);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cognito_groups" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;
