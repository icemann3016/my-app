ALTER TABLE "user_settings" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_phone" CHECK ("user_settings"."phone" ~ '^\+[0-9 ]{6,20}$');