CREATE TYPE "public"."defect_severity" AS ENUM('minor', 'major', 'unsafe');--> statement-breakpoint
CREATE TABLE "defects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"booking_id" uuid,
	"reported_by" uuid,
	"severity" "defect_severity" NOT NULL,
	"description" text NOT NULL,
	"photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	CONSTRAINT "defects_text" CHECK (char_length(btrim("defects"."description")) between 1 and 2000
        and char_length("defects"."resolution") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "defects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_photo_id_documents_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defects_aircraft_idx" ON "defects" USING btree ("aircraft_id","created_at");