-- Security hardening:
-- * rate_limits table for Postgres-backed sliding-window counters
-- * otp_codes.attempts for brute-force lockout
-- * booking_guests.access_token_hash for non-PK bearer token
-- * support_threads.anon_id to bind anonymous chat sessions

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("key", "window_start")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rate_limits_window_idx" ON "rate_limits" ("window_start");
--> statement-breakpoint

ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE "booking_guests" ADD COLUMN IF NOT EXISTS "access_token_hash" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "booking_guests_access_token_hash_idx"
  ON "booking_guests" ("access_token_hash")
  WHERE "access_token_hash" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "anon_id" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_threads_anon_id_idx"
  ON "support_threads" ("anon_id")
  WHERE "anon_id" IS NOT NULL;
