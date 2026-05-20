CREATE TABLE IF NOT EXISTS "membership_hour_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "membership_id" text NOT NULL,
  "booking_id" text,
  "kind" text NOT NULL,
  "minutes" integer NOT NULL,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_hour_ledger" ADD CONSTRAINT "membership_hour_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_hour_ledger" ADD CONSTRAINT "membership_hour_ledger_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_hour_ledger" ADD CONSTRAINT "membership_hour_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_hour_ledger_membership_idx" ON "membership_hour_ledger" ("membership_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_hour_ledger_booking_idx" ON "membership_hour_ledger" ("booking_id");
