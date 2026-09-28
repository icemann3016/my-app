CREATE TYPE "public"."uplift_kind" AS ENUM('fuel', 'oil');--> statement-breakpoint
CREATE TYPE "public"."uplift_payer" AS ENUM('pilot', 'owner');--> statement-breakpoint
CREATE TABLE "flight_uplifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flight_log_id" uuid NOT NULL,
	"kind" "uplift_kind" NOT NULL,
	"airport_ident" text NOT NULL,
	"quantity_l" numeric(6, 1) NOT NULL,
	"fuel_type" "fuel_type",
	"oil_grade" text,
	"price" numeric(10, 2),
	"paid_by" "uplift_payer" NOT NULL,
	"receipt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_uplifts_values" CHECK ("flight_uplifts"."quantity_l" > 0 and "flight_uplifts"."quantity_l" <= 5000 and ("flight_uplifts"."price" is null or "flight_uplifts"."price" >= 0)
        and char_length("flight_uplifts"."oil_grade") <= 40
        and ("flight_uplifts"."kind" = 'fuel' or "flight_uplifts"."fuel_type" is null)
        and ("flight_uplifts"."kind" = 'oil' or "flight_uplifts"."oil_grade" is null))
);
--> statement-breakpoint
ALTER TABLE "flight_uplifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "flight_uplifts" ADD CONSTRAINT "flight_uplifts_flight_log_id_flight_logs_id_fk" FOREIGN KEY ("flight_log_id") REFERENCES "public"."flight_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_uplifts" ADD CONSTRAINT "flight_uplifts_airport_ident_airports_ident_fk" FOREIGN KEY ("airport_ident") REFERENCES "public"."airports"("ident") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_uplifts" ADD CONSTRAINT "flight_uplifts_receipt_id_documents_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flight_uplifts_log_idx" ON "flight_uplifts" USING btree ("flight_log_id");