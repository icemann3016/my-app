ALTER TABLE "bookings" ADD COLUMN "weekend_price_per_hour" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "min_hours_per_day" numeric(3, 1);