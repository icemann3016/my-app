-- Leg checks in the order things happen: engine start <= block off < take-off < landing < block on
-- <= engine stop (max 12 h), meters strictly forward, fuel down and oil not up during a leg.
-- NOT VALID: legs saved under the earlier rules (block off before engine start) stay as they are;
-- new and edited legs must follow these rules.
ALTER TABLE "flight_legs" DROP CONSTRAINT "flight_legs_times";--> statement-breakpoint
ALTER TABLE "flight_legs" DROP CONSTRAINT "flight_legs_meters";--> statement-breakpoint
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_fuel_oil" CHECK (("flight_legs"."fuel_after_l" is null or "flight_legs"."fuel_before_l" is null or "flight_legs"."fuel_after_l" < "flight_legs"."fuel_before_l")
        and ("flight_legs"."oil_after_l" is null or "flight_legs"."oil_before_l" is null or "flight_legs"."oil_after_l" <= "flight_legs"."oil_before_l")) NOT VALID;--> statement-breakpoint
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_times" CHECK ("flight_legs"."engine_start" <= "flight_legs"."block_off" and "flight_legs"."block_off" < "flight_legs"."block_on"
        and "flight_legs"."block_on" <= "flight_legs"."engine_stop"
        and ("flight_legs"."takeoff_at" is null or ("flight_legs"."block_off" < "flight_legs"."takeoff_at"
          and "flight_legs"."takeoff_at" < coalesce("flight_legs"."landing_at", "flight_legs"."block_on")))
        and ("flight_legs"."landing_at" is null or ("flight_legs"."block_off" < "flight_legs"."landing_at"
          and "flight_legs"."landing_at" < "flight_legs"."block_on"))
        and "flight_legs"."engine_stop" - "flight_legs"."engine_start" <= interval '12 hours') NOT VALID;--> statement-breakpoint
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_meters" CHECK (("flight_legs"."hobbs_end" is null or "flight_legs"."hobbs_start" is null or "flight_legs"."hobbs_end" > "flight_legs"."hobbs_start")
        and ("flight_legs"."tach_end" is null or "flight_legs"."tach_start" is null or "flight_legs"."tach_end" > "flight_legs"."tach_start")
        and "flight_legs"."hobbs_start" >= 0 and "flight_legs"."tach_start" >= 0) NOT VALID;
