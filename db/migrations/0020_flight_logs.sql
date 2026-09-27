CREATE TYPE "public"."flight_log_status" AS ENUM('draft', 'submitted', 'correction_requested', 'confirmed');--> statement-breakpoint
CREATE TABLE "flight_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flight_log_id" uuid NOT NULL,
	"seq" smallint NOT NULL,
	"from_ident" text NOT NULL,
	"to_ident" text NOT NULL,
	"block_off" timestamp with time zone NOT NULL,
	"engine_start" timestamp with time zone NOT NULL,
	"takeoff_at" timestamp with time zone,
	"landing_at" timestamp with time zone,
	"engine_stop" timestamp with time zone NOT NULL,
	"block_on" timestamp with time zone NOT NULL,
	"landings" smallint DEFAULT 1 NOT NULL,
	"hobbs_start" numeric(8, 2),
	"hobbs_end" numeric(8, 2),
	"tach_start" numeric(8, 2),
	"tach_end" numeric(8, 2),
	"fuel_before_l" numeric(6, 1),
	"fuel_after_l" numeric(6, 1),
	"oil_before_l" numeric(6, 1),
	"oil_after_l" numeric(6, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_legs_seq" UNIQUE("flight_log_id","seq"),
	CONSTRAINT "flight_legs_times" CHECK ("flight_legs"."block_off" <= "flight_legs"."engine_start" and "flight_legs"."engine_start" <= "flight_legs"."engine_stop"
        and "flight_legs"."engine_stop" <= "flight_legs"."block_on"
        and ("flight_legs"."takeoff_at" is null or ("flight_legs"."engine_start" <= "flight_legs"."takeoff_at"
          and "flight_legs"."takeoff_at" <= coalesce("flight_legs"."landing_at", "flight_legs"."engine_stop")))
        and ("flight_legs"."landing_at" is null or "flight_legs"."landing_at" <= "flight_legs"."engine_stop")
        and "flight_legs"."block_on" - "flight_legs"."block_off" <= interval '24 hours'),
	CONSTRAINT "flight_legs_meters" CHECK (("flight_legs"."hobbs_end" is null or "flight_legs"."hobbs_start" is null or "flight_legs"."hobbs_end" >= "flight_legs"."hobbs_start")
        and ("flight_legs"."tach_end" is null or "flight_legs"."tach_start" is null or "flight_legs"."tach_end" >= "flight_legs"."tach_start")
        and "flight_legs"."hobbs_start" >= 0 and "flight_legs"."tach_start" >= 0),
	CONSTRAINT "flight_legs_amounts" CHECK ("flight_legs"."landings" between 1 and 99 and "flight_legs"."fuel_before_l" >= 0 and "flight_legs"."fuel_after_l" >= 0
        and "flight_legs"."oil_before_l" >= 0 and "flight_legs"."oil_after_l" >= 0 and "flight_legs"."seq" between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "flight_legs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "flight_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"status" "flight_log_status" DEFAULT 'draft' NOT NULL,
	"hobbs_start" numeric(8, 2),
	"tach_start" numeric(8, 2),
	"fuel_start_l" numeric(6, 1),
	"oil_start_l" numeric(6, 1),
	"checkout_photo_id" uuid,
	"checked_out_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flown_minutes" integer,
	"amount_due" numeric(10, 2),
	"fuel_adjustment" numeric(10, 2),
	"submitted_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"correction_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_logs_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "flight_logs_readings" CHECK ("flight_logs"."hobbs_start" >= 0 and "flight_logs"."tach_start" >= 0 and "flight_logs"."fuel_start_l" >= 0
        and "flight_logs"."oil_start_l" >= 0),
	CONSTRAINT "flight_logs_note" CHECK (char_length("flight_logs"."correction_note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "flight_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_flight_log_id_flight_logs_id_fk" FOREIGN KEY ("flight_log_id") REFERENCES "public"."flight_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_from_ident_airports_ident_fk" FOREIGN KEY ("from_ident") REFERENCES "public"."airports"("ident") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_to_ident_airports_ident_fk" FOREIGN KEY ("to_ident") REFERENCES "public"."airports"("ident") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_logs" ADD CONSTRAINT "flight_logs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_logs" ADD CONSTRAINT "flight_logs_checkout_photo_id_documents_id_fk" FOREIGN KEY ("checkout_photo_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flight_legs_log_idx" ON "flight_legs" USING btree ("flight_log_id");