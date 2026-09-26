CREATE TABLE "airports" (
	"ident" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"icao_code" text,
	"iata_code" text,
	"gps_code" text,
	"local_code" text,
	"municipality" text,
	"country" text NOT NULL,
	"region" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"elevation_ft" integer,
	"timezone" text NOT NULL,
	"keywords" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "airports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "home_airport_ident" text;--> statement-breakpoint
CREATE INDEX "airports_icao_code_idx" ON "airports" USING btree ("icao_code");--> statement-breakpoint
CREATE INDEX "airports_iata_code_idx" ON "airports" USING btree ("iata_code");--> statement-breakpoint
CREATE INDEX "airports_country_idx" ON "airports" USING btree ("country");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_home_airport_ident_airports_ident_fk" FOREIGN KEY ("home_airport_ident") REFERENCES "public"."airports"("ident") ON DELETE set null ON UPDATE no action;