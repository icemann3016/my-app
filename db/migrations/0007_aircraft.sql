CREATE TYPE "public"."aircraft_category" AS ENUM('aeroplane', 'tmg', 'ultralight', 'helicopter');--> statement-breakpoint
CREATE TYPE "public"."aircraft_document_kind" AS ENUM('cofa', 'arc', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."aircraft_file_kind" AS ENUM('poh', 'checklist', 'weight_balance', 'other');--> statement-breakpoint
CREATE TYPE "public"."aircraft_status" AS ENUM('draft', 'listed', 'paused', 'unlisted', 'grounded');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('avgas_100ll', 'ul91', 'mogas', 'jet_a1');--> statement-breakpoint
CREATE TYPE "public"."oil_unit" AS ENUM('us_qt', 'l');--> statement-breakpoint
CREATE TYPE "public"."price_basis" AS ENUM('wet', 'dry');--> statement-breakpoint
CREATE TYPE "public"."time_basis" AS ENUM('hobbs', 'tach', 'block');--> statement-breakpoint
CREATE TYPE "public"."transponder_type" AS ENUM('none', 'mode_c', 'mode_s', 'mode_s_es');--> statement-breakpoint
CREATE TYPE "public"."unrated_policy" AS ENUM('allow', 'checkout', 'deny');--> statement-breakpoint
CREATE TABLE "aircraft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"registration" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"icao_type" text,
	"year" integer,
	"category" "aircraft_category" DEFAULT 'aeroplane' NOT NULL,
	"seats" integer,
	"engine" text,
	"fuel_type" "fuel_type",
	"fuel_burn_lph" numeric(5, 1),
	"cruise_kt" integer,
	"useful_load_kg" integer,
	"endurance_h" numeric(3, 1),
	"oil_unit" "oil_unit" DEFAULT 'us_qt' NOT NULL,
	"avionics" text,
	"autopilot" boolean DEFAULT false NOT NULL,
	"transponder" "transponder_type" DEFAULT 'mode_s' NOT NULL,
	"adsb_out" boolean DEFAULT false NOT NULL,
	"night_vfr" boolean DEFAULT false NOT NULL,
	"ifr" boolean DEFAULT false NOT NULL,
	"equipment_notes" text,
	"description" text,
	"home_airport_ident" text,
	"price_per_hour" numeric(8, 2),
	"weekend_price_per_hour" numeric(8, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"price_basis" "price_basis" DEFAULT 'wet' NOT NULL,
	"time_basis" time_basis DEFAULT 'hobbs' NOT NULL,
	"min_hours_per_day" numeric(3, 1),
	"free_cancellation_hours" integer DEFAULT 24 NOT NULL,
	"cancellation_note" text,
	"status" "aircraft_status" DEFAULT 'draft' NOT NULL,
	"status_reason" text,
	"publish_requested_at" timestamp with time zone,
	"listed_at" timestamp with time zone,
	"rating_avg" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_registration" CHECK ("aircraft"."registration" ~ '^[A-Z0-9][A-Z0-9-]{1,8}[A-Z0-9]$'),
	CONSTRAINT "aircraft_icao_type" CHECK ("aircraft"."icao_type" ~ '^[A-Z0-9]{2,4}$'),
	CONSTRAINT "aircraft_year" CHECK ("aircraft"."year" between 1903 and 2100),
	CONSTRAINT "aircraft_seats" CHECK ("aircraft"."seats" between 1 and 20),
	CONSTRAINT "aircraft_currency" CHECK ("aircraft"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "aircraft_numbers" CHECK (coalesce("aircraft"."fuel_burn_lph", 0) >= 0 and coalesce("aircraft"."cruise_kt", 0) >= 0
        and coalesce("aircraft"."useful_load_kg", 0) >= 0 and coalesce("aircraft"."endurance_h", 0) >= 0
        and coalesce("aircraft"."price_per_hour", 0) >= 0 and coalesce("aircraft"."weekend_price_per_hour", 0) >= 0
        and coalesce("aircraft"."min_hours_per_day", 0) >= 0),
	CONSTRAINT "aircraft_cancellation_hours" CHECK ("aircraft"."free_cancellation_hours" between 0 and 720),
	CONSTRAINT "aircraft_text_lengths" CHECK (char_length("aircraft"."manufacturer") <= 60 and char_length("aircraft"."model") <= 60
        and char_length("aircraft"."engine") <= 100 and char_length("aircraft"."avionics") <= 200
        and char_length("aircraft"."equipment_notes") <= 1000 and char_length("aircraft"."description") <= 4000
        and char_length("aircraft"."cancellation_note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "aircraft" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "aircraft_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"kind" "aircraft_document_kind" NOT NULL,
	"expires_on" date,
	"document_id" uuid,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_documents_expiry" CHECK ("aircraft_documents"."kind" = 'cofa' or "aircraft_documents"."expires_on" is not null)
);
--> statement-breakpoint
ALTER TABLE "aircraft_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "aircraft_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"kind" "aircraft_file_kind" NOT NULL,
	"title" text,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_files_title" CHECK (char_length("aircraft_files"."title") <= 100)
);
--> statement-breakpoint
ALTER TABLE "aircraft_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "aircraft_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_photos_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "aircraft_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_requirements" (
	"aircraft_id" uuid PRIMARY KEY NOT NULL,
	"min_pilot_rating" numeric(2, 1),
	"min_reviews" integer DEFAULT 1 NOT NULL,
	"unrated_policy" "unrated_policy" DEFAULT 'checkout' NOT NULL,
	"licence_types" "licence_type"[] DEFAULT '{}' NOT NULL,
	"required_ratings" text[] DEFAULT '{}' NOT NULL,
	"min_total_hours" numeric(6, 1),
	"min_type_hours" numeric(6, 1),
	"min_90_day_hours" numeric(5, 1),
	"min_age" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_requirements_values" CHECK (("rental_requirements"."min_pilot_rating" is null or "rental_requirements"."min_pilot_rating" between 1 and 5)
        and "rental_requirements"."min_reviews" between 1 and 50
        and coalesce("rental_requirements"."min_total_hours", 0) >= 0 and coalesce("rental_requirements"."min_type_hours", 0) >= 0
        and coalesce("rental_requirements"."min_90_day_hours", 0) >= 0
        and ("rental_requirements"."min_age" is null or "rental_requirements"."min_age" between 16 and 99)
        and cardinality("rental_requirements"."required_ratings") <= 10)
);
--> statement-breakpoint
ALTER TABLE "rental_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_home_airport_ident_airports_ident_fk" FOREIGN KEY ("home_airport_ident") REFERENCES "public"."airports"("ident") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_files" ADD CONSTRAINT "aircraft_files_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_files" ADD CONSTRAINT "aircraft_files_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_photos" ADD CONSTRAINT "aircraft_photos_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_requirements" ADD CONSTRAINT "rental_requirements_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aircraft_owner_id_idx" ON "aircraft" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "aircraft_status_idx" ON "aircraft" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aircraft_home_airport_idx" ON "aircraft" USING btree ("home_airport_ident");--> statement-breakpoint
CREATE UNIQUE INDEX "aircraft_live_registration_idx" ON "aircraft" USING btree ("registration") WHERE status in ('listed', 'paused', 'grounded');--> statement-breakpoint
CREATE INDEX "aircraft_documents_aircraft_idx" ON "aircraft_documents" USING btree ("aircraft_id");--> statement-breakpoint
CREATE INDEX "aircraft_files_aircraft_idx" ON "aircraft_files" USING btree ("aircraft_id");--> statement-breakpoint
CREATE INDEX "aircraft_photos_aircraft_idx" ON "aircraft_photos" USING btree ("aircraft_id","sort_order");