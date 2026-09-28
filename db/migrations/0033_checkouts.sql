CREATE TABLE "aircraft_checkouts" (
	"aircraft_id" uuid NOT NULL,
	"pilot_id" uuid NOT NULL,
	"done_on" date NOT NULL,
	"instructor" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_checkouts_aircraft_id_pilot_id_pk" PRIMARY KEY("aircraft_id","pilot_id"),
	CONSTRAINT "aircraft_checkouts_text" CHECK (char_length("aircraft_checkouts"."instructor") <= 100 and char_length("aircraft_checkouts"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "aircraft_checkouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_requirements" ADD COLUMN "checkout_first_rental" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aircraft_checkouts" ADD CONSTRAINT "aircraft_checkouts_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_checkouts" ADD CONSTRAINT "aircraft_checkouts_pilot_id_users_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;