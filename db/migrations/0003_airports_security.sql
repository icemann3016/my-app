-- M2 security: airports are public and read-only for users; users may set their home airfield.

GRANT SELECT ON public.airports TO app_user;
--> statement-breakpoint
CREATE POLICY airports_select_all ON public.airports
  FOR SELECT TO app_user USING (true);
--> statement-breakpoint
GRANT UPDATE (home_airport_ident) ON public.profiles TO app_user;
--> statement-breakpoint
-- Keep existing home airfields where the airport is already imported (a fresh database has none
-- yet; users simply pick their airfield again after `npm run airports:import`).
UPDATE public.profiles p
SET home_airport_ident = p.home_airport_icao
WHERE p.home_airport_icao IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.airports a WHERE a.ident = p.home_airport_icao);
