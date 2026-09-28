CREATE TYPE "public"."remark_kind" AS ENUM('aircraft', 'weather', 'airfield');--> statement-breakpoint
CREATE TABLE "flight_remarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flight_log_id" uuid NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"kind" "remark_kind" NOT NULL,
	"airport_ident" text,
	"body" text NOT NULL,
	"known_since" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_remarks_values" CHECK (char_length(btrim("flight_remarks"."body")) between 1 and 1000
        and ("flight_remarks"."known_since" is null or "flight_remarks"."kind" = 'aircraft'))
);
--> statement-breakpoint
ALTER TABLE "flight_remarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "flight_remarks" ADD CONSTRAINT "flight_remarks_flight_log_id_flight_logs_id_fk" FOREIGN KEY ("flight_log_id") REFERENCES "public"."flight_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_remarks" ADD CONSTRAINT "flight_remarks_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_remarks" ADD CONSTRAINT "flight_remarks_airport_ident_airports_ident_fk" FOREIGN KEY ("airport_ident") REFERENCES "public"."airports"("ident") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flight_remarks_log_idx" ON "flight_remarks" USING btree ("flight_log_id");--> statement-breakpoint
CREATE INDEX "flight_remarks_aircraft_idx" ON "flight_remarks" USING btree ("aircraft_id","created_at");