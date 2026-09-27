CREATE TYPE "public"."calendar_entry_kind" AS ENUM('booking', 'owner_use', 'maintenance', 'unavailable');--> statement-breakpoint
CREATE TABLE "calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"period" "tstzrange" NOT NULL,
	"kind" "calendar_entry_kind" NOT NULL,
	"booking_id" uuid,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_entries_period" CHECK (not isempty("calendar_entries"."period") and lower_inc("calendar_entries"."period") and not upper_inc("calendar_entries"."period")
        and not lower_inf("calendar_entries"."period") and not upper_inf("calendar_entries"."period")
        and upper("calendar_entries"."period") - lower("calendar_entries"."period") <= interval '366 days'),
	CONSTRAINT "calendar_entries_note" CHECK (char_length("calendar_entries"."note") <= 200),
	CONSTRAINT "calendar_entries_booking" CHECK (("calendar_entries"."kind" = 'booking') = ("calendar_entries"."booking_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "calendar_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_entries_aircraft_idx" ON "calendar_entries" USING btree ("aircraft_id");