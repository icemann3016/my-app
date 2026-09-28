CREATE TYPE "public"."review_direction" AS ENUM('pilot_to_owner', 'owner_to_pilot');--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"direction" "review_direction" NOT NULL,
	"author_id" uuid,
	"subject_user_id" uuid,
	"subject_aircraft_id" uuid,
	"scores" jsonb NOT NULL,
	"overall" numeric(3, 2) NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"hidden_by" uuid,
	"hidden_reason" text,
	"reply" text,
	"replied_at" timestamp with time zone,
	CONSTRAINT "reviews_one_per_side" UNIQUE("booking_id","direction"),
	CONSTRAINT "reviews_overall" CHECK ("reviews"."overall" between 1 and 5),
	CONSTRAINT "reviews_texts" CHECK (char_length("reviews"."comment") <= 2000 and char_length("reviews"."reply") <= 1000
        and char_length("reviews"."hidden_reason") <= 500)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "owner_rating_avg" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "owner_rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_aircraft_id_aircraft_id_fk" FOREIGN KEY ("subject_aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hidden_by_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_subject_user_idx" ON "reviews" USING btree ("subject_user_id","published_at");--> statement-breakpoint
CREATE INDEX "reviews_subject_aircraft_idx" ON "reviews" USING btree ("subject_aircraft_id","published_at");--> statement-breakpoint
CREATE INDEX "reviews_unpublished_idx" ON "reviews" USING btree ("submitted_at") WHERE published_at is null;