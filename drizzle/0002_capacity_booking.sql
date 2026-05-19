-- Capacity-based booking: nullable bay_id (assigned later), holds get status,
-- new admin/maintenance blocks table, indexes for availability queries.

ALTER TABLE "bookings" ALTER COLUMN "bay_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_holds" ALTER COLUMN "bay_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "block_type" AS ENUM ('admin_block', 'maintenance_block');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "booking_blocks" (
  "id" text PRIMARY KEY NOT NULL,
  "location_id" text NOT NULL,
  "bay_id" text,
  "type" "block_type" NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "reason" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_location_id_locations_id_fk"
    FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_bay_id_bays_id_fk"
    FOREIGN KEY ("bay_id") REFERENCES "public"."bays"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bookings_starts_ends_idx" ON "bookings" ("location_id", "starts_at", "ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_holds_starts_ends_idx" ON "booking_holds" ("location_id", "starts_at", "ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_holds_expires_idx" ON "booking_holds" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_holds_status_idx" ON "booking_holds" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_blocks_starts_ends_idx" ON "booking_blocks" ("location_id", "starts_at", "ends_at");
