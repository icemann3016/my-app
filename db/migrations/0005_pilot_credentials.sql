CREATE TYPE "public"."licence_type" AS ENUM('lapl_a', 'ppl_a', 'cpl_a', 'atpl_a', 'mpl', 'other');--> statement-breakpoint
CREATE TYPE "public"."medical_class" AS ENUM('class1', 'class2', 'lapl');--> statement-breakpoint
CREATE TYPE "public"."rating_kind" AS ENUM('class', 'type', 'privilege');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_by_type" (
	"user_id" uuid NOT NULL,
	"aircraft_type" text NOT NULL,
	"hours" numeric(7, 1) NOT NULL,
	CONSTRAINT "experience_by_type_user_id_aircraft_type_pk" PRIMARY KEY("user_id","aircraft_type"),
	CONSTRAINT "experience_by_type_type" CHECK ("experience_by_type"."aircraft_type" ~ '^[A-Z0-9]{2,6}$'),
	CONSTRAINT "experience_by_type_hours" CHECK ("experience_by_type"."hours" >= 0)
);
--> statement-breakpoint
ALTER TABLE "experience_by_type" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medicals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"class" "medical_class" NOT NULL,
	"issuing_state" text NOT NULL,
	"valid_until" date NOT NULL,
	"document_id" uuid,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medicals_state" CHECK ("medicals"."issuing_state" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "medicals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pilot_experience" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_hours" numeric(7, 1) NOT NULL,
	"pic_hours" numeric(7, 1) NOT NULL,
	"last_90_days_hours" numeric(6, 1) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilot_experience_hours" CHECK ("pilot_experience"."total_hours" >= 0 and "pilot_experience"."pic_hours" >= 0 and "pilot_experience"."last_90_days_hours" >= 0
        and "pilot_experience"."pic_hours" <= "pilot_experience"."total_hours" and "pilot_experience"."last_90_days_hours" <= "pilot_experience"."total_hours")
);
--> statement-breakpoint
ALTER TABLE "pilot_experience" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pilot_licences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "licence_type" NOT NULL,
	"issuing_state" text NOT NULL,
	"number" text NOT NULL,
	"issued_on" date,
	"expires_on" date,
	"document_id" uuid,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilot_licences_number_length" CHECK (char_length("pilot_licences"."number") between 1 and 50),
	CONSTRAINT "pilot_licences_state" CHECK ("pilot_licences"."issuing_state" ~ '^[A-Z]{2}$'),
	CONSTRAINT "pilot_licences_dates" CHECK ("pilot_licences"."expires_on" is null or "pilot_licences"."issued_on" is null or "pilot_licences"."expires_on" >= "pilot_licences"."issued_on")
);
--> statement-breakpoint
ALTER TABLE "pilot_licences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pilot_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "rating_kind" NOT NULL,
	"code" text NOT NULL,
	"expires_on" date,
	"document_id" uuid,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilot_ratings_code" CHECK ("pilot_ratings"."code" ~ '^[A-Z0-9_]{2,20}$')
);
--> statement-breakpoint
ALTER TABLE "pilot_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_by_type" ADD CONSTRAINT "experience_by_type_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicals" ADD CONSTRAINT "medicals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicals" ADD CONSTRAINT "medicals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicals" ADD CONSTRAINT "medicals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_experience" ADD CONSTRAINT "pilot_experience_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_licences" ADD CONSTRAINT "pilot_licences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_licences" ADD CONSTRAINT "pilot_licences_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_licences" ADD CONSTRAINT "pilot_licences_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_ratings" ADD CONSTRAINT "pilot_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_ratings" ADD CONSTRAINT "pilot_ratings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_ratings" ADD CONSTRAINT "pilot_ratings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_target_idx" ON "admin_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "documents_owner_id_idx" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "medicals_user_id_idx" ON "medicals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pilot_licences_user_id_idx" ON "pilot_licences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pilot_ratings_user_id_idx" ON "pilot_ratings" USING btree ("user_id");