CREATE TYPE "public"."aircraft_category" AS ENUM('aeroplane', 'tmg', 'ultralight', 'helicopter');--> statement-breakpoint
CREATE TYPE "public"."aircraft_document_kind" AS ENUM('cofa', 'arc', 'insurance', 'poh', 'checklist', 'weight_balance');--> statement-breakpoint
CREATE TYPE "public"."aircraft_status" AS ENUM('draft', 'listed', 'paused', 'unlisted', 'grounded');--> statement-breakpoint
CREATE TYPE "public"."cancellation_policy" AS ENUM('flexible', 'moderate', 'strict');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('avgas_100ll', 'ul91', 'mogas', 'jet_a1');--> statement-breakpoint
CREATE TYPE "public"."oil_unit" AS ENUM('qt', 'l');--> statement-breakpoint
CREATE TYPE "public"."price_basis" AS ENUM('wet', 'dry');--> statement-breakpoint
CREATE TYPE "public"."time_basis" AS ENUM('hobbs', 'tach', 'block');--> statement-breakpoint
CREATE TYPE "public"."transponder_type" AS ENUM('none', 'mode_c', 'mode_s', 'adsb_out');--> statement-breakpoint
CREATE TABLE "aircraft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"registration" text NOT NULL,
	"manufacturer" text NOT NULL,
	"model" text NOT NULL,
	"type_designator" text NOT NULL,
	"year" smallint,
	"category" "aircraft_category" DEFAULT 'aeroplane' NOT NULL,
	"seats" smallint NOT NULL,
	"engine" text,
	"fuel_type" "fuel_type" NOT NULL,
	"fuel_burn_lph" numeric(5, 1),
	"cruise_kt" smallint,
	"useful_load_kg" smallint,
	"endurance_h" numeric(3, 1),
	"avionics" text,
	"autopilot" boolean DEFAULT false NOT NULL,
	"transponder" "transponder_type" DEFAULT 'mode_s' NOT NULL,
	"night_vfr" boolean DEFAULT false NOT NULL,
	"ifr" boolean DEFAULT false NOT NULL,
	"description" text,
	"home_airport_ident" text,
	"price_per_hour" numeric(8, 2),
	"weekend_price_per_hour" numeric(8, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"price_basis" "price_basis" DEFAULT 'wet' NOT NULL,
	"time_basis" time_basis DEFAULT 'hobbs' NOT NULL,
	"min_hours_per_day" numeric(3, 1),
	"oil_unit" "oil_unit" DEFAULT 'qt' NOT NULL,
	"cancellation_policy" "cancellation_policy" DEFAULT 'moderate' NOT NULL,
	"status" "aircraft_status" DEFAULT 'draft' NOT NULL,
	"unlisted_reason" text,
	"rating_avg" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_registration" CHECK ("aircraft"."registration" ~ '^[A-Z0-9]{1,3}-?[A-Z0-9]{1,6}$'),
	CONSTRAINT "aircraft_names" CHECK (char_length(btrim("aircraft"."manufacturer")) between 1 and 60
        and char_length(btrim("aircraft"."model")) between 1 and 60
        and char_length("aircraft"."engine") <= 80 and char_length("aircraft"."avionics") <= 300),
	CONSTRAINT "aircraft_type_designator" CHECK ("aircraft"."type_designator" ~ '^[A-Z0-9]{2,4}$'),
	CONSTRAINT "aircraft_year" CHECK ("aircraft"."year" between 1903 and 2100),
	CONSTRAINT "aircraft_seats" CHECK ("aircraft"."seats" between 1 and 20),
	CONSTRAINT "aircraft_performance" CHECK ("aircraft"."fuel_burn_lph" > 0 and "aircraft"."cruise_kt" > 0 and "aircraft"."useful_load_kg" > 0
        and "aircraft"."endurance_h" > 0),
	CONSTRAINT "aircraft_description" CHECK (char_length("aircraft"."description") <= 4000),
	CONSTRAINT "aircraft_prices" CHECK ("aircraft"."price_per_hour" > 0 and "aircraft"."weekend_price_per_hour" > 0
        and "aircraft"."min_hours_per_day" > 0 and "aircraft"."min_hours_per_day" <= 12),
	CONSTRAINT "aircraft_currency" CHECK ("aircraft"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "aircraft" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "aircraft_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"kind" "aircraft_document_kind" NOT NULL,
	"title" text,
	"document_id" uuid NOT NULL,
	"expires_on" date,
	"status" "verification_status",
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_documents_status" CHECK (("aircraft_documents"."kind" in ('cofa', 'arc', 'insurance')) = ("aircraft_documents"."status" is not null)),
	CONSTRAINT "aircraft_documents_expiry" CHECK ("aircraft_documents"."kind" not in ('arc', 'insurance') or "aircraft_documents"."expires_on" is not null),
	CONSTRAINT "aircraft_documents_title" CHECK (char_length("aircraft_documents"."title") <= 100)
);
--> statement-breakpoint
ALTER TABLE "aircraft_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "aircraft_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_photos_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "aircraft_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_requirements" (
	"aircraft_id" uuid PRIMARY KEY NOT NULL,
	"min_pilot_rating" numeric(2, 1),
	"allow_unrated" boolean DEFAULT true NOT NULL,
	"unrated_needs_checkout" boolean DEFAULT false NOT NULL,
	"licence_types" "licence_type"[] DEFAULT '{}' NOT NULL,
	"required_ratings" text[] DEFAULT '{}' NOT NULL,
	"min_total_hours" numeric(6, 1),
	"min_type_hours" numeric(6, 1),
	"min_90_days_hours" numeric(5, 1),
	"min_age" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_requirements_rating" CHECK ("rental_requirements"."min_pilot_rating" between 1 and 5),
	CONSTRAINT "rental_requirements_hours" CHECK ("rental_requirements"."min_total_hours" >= 0 and "rental_requirements"."min_type_hours" >= 0 and "rental_requirements"."min_90_days_hours" >= 0),
	CONSTRAINT "rental_requirements_age" CHECK ("rental_requirements"."min_age" between 16 and 99),
	CONSTRAINT "rental_requirements_checkout" CHECK (not "rental_requirements"."unrated_needs_checkout" or "rental_requirements"."allow_unrated"),
	CONSTRAINT "rental_requirements_ratings" CHECK (cardinality("rental_requirements"."required_ratings") <= 10)
);
--> statement-breakpoint
ALTER TABLE "rental_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_home_airport_ident_airports_ident_fk" FOREIGN KEY ("home_airport_ident") REFERENCES "public"."airports"("ident") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_photos" ADD CONSTRAINT "aircraft_photos_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_requirements" ADD CONSTRAINT "rental_requirements_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aircraft_owner_id_idx" ON "aircraft" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "aircraft_home_airport_idx" ON "aircraft" USING btree ("home_airport_ident");--> statement-breakpoint
CREATE INDEX "aircraft_status_idx" ON "aircraft" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "aircraft_registration_unique" ON "aircraft" USING btree ("registration") WHERE "aircraft"."status" <> 'draft';--> statement-breakpoint
CREATE INDEX "aircraft_documents_aircraft_idx" ON "aircraft_documents" USING btree ("aircraft_id");--> statement-breakpoint
CREATE INDEX "aircraft_photos_aircraft_idx" ON "aircraft_photos" USING btree ("aircraft_id","sort_order");