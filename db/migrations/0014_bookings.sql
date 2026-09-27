CREATE TYPE "public"."booking_purpose" AS ENUM('local', 'cross_country', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'accepted', 'declined', 'expired', 'cancelled', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"pilot_id" uuid,
	"owner_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"period" "tstzrange" NOT NULL,
	"departure_ident" text NOT NULL,
	"arrival_ident" text NOT NULL,
	"stops" text[] DEFAULT '{}' NOT NULL,
	"purpose" "booking_purpose" NOT NULL,
	"passengers" smallint DEFAULT 0 NOT NULL,
	"planned_hours" numeric(4, 1) NOT NULL,
	"message" text,
	"price_per_hour" numeric(8, 2) NOT NULL,
	"currency" text NOT NULL,
	"price_basis" "price_basis" NOT NULL,
	"time_basis" time_basis NOT NULL,
	"estimate" numeric(10, 2) NOT NULL,
	"checkout_required" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"owner_note" text,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"late_cancellation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_passengers" CHECK ("bookings"."passengers" between 0 and 19),
	CONSTRAINT "bookings_hours" CHECK ("bookings"."planned_hours" > 0),
	CONSTRAINT "bookings_stops" CHECK (cardinality("bookings"."stops") <= 5),
	CONSTRAINT "bookings_texts" CHECK (char_length("bookings"."message") <= 1000 and char_length("bookings"."owner_note") <= 500
        and char_length("bookings"."cancel_reason") <= 500)
);
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pilot_id_users_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_ident_airports_ident_fk" FOREIGN KEY ("departure_ident") REFERENCES "public"."airports"("ident") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_arrival_ident_airports_ident_fk" FOREIGN KEY ("arrival_ident") REFERENCES "public"."airports"("ident") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_aircraft_idx" ON "bookings" USING btree ("aircraft_id");--> statement-breakpoint
CREATE INDEX "bookings_pilot_idx" ON "bookings" USING btree ("pilot_id");--> statement-breakpoint
CREATE INDEX "bookings_owner_idx" ON "bookings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status","expires_at");