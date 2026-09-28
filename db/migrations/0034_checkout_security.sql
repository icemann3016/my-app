-- M6 checkout flights (BKG-10). The owner records a pilot's checkout flight on their aircraft;
-- the pilot sees their own records. eligibility_failures() now asks for a checkout for every pilot
-- new to the aircraft when the owner wants that (checkout_first_rental), and never once recorded.

GRANT UPDATE (checkout_first_rental) ON public.rental_requirements TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.aircraft_checkouts TO app_user;
--> statement-breakpoint
GRANT UPDATE (done_on, instructor, note) ON public.aircraft_checkouts TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_checkouts_select ON public.aircraft_checkouts FOR SELECT TO app_user
  USING (pilot_id = app.current_user_id() OR public.user_has_role('admin') OR EXISTS (
    SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY aircraft_checkouts_write ON public.aircraft_checkouts FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.aircraft a
                      WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id())
    -- only pilots who have booked the aircraft
    AND EXISTS (SELECT 1 FROM public.bookings b
                WHERE b.aircraft_id = aircraft_checkouts.aircraft_id
                  AND b.pilot_id = aircraft_checkouts.pilot_id));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.eligibility_failures(
  pilot uuid, target uuid, wanted tstzrange, airfields text[] DEFAULT NULL)
RETURNS TABLE (requirement text, blocking boolean, need text, have text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  plane public.aircraft%ROWTYPE;
  req public.rental_requirements%ROWTYPE;
  has_req boolean;
  prof public.profiles%ROWTYPE;
  xp public.pilot_experience%ROWTYPE;
  on_day date := (coalesce(upper(wanted), now()) AT TIME ZONE 'utc')::date;
  wanted_code text;
  type_hours numeric;
  years int;
  field record;
  is_night boolean := false;
BEGIN
  SELECT * INTO plane FROM public.aircraft WHERE id = target;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'aircraft_unavailable', true, NULL::text, NULL::text;
    RETURN;
  END IF;
  SELECT * INTO req FROM public.rental_requirements WHERE aircraft_id = target;
  has_req := FOUND;
  SELECT * INTO prof FROM public.profiles WHERE id = pilot;
  SELECT * INTO xp FROM public.pilot_experience WHERE user_id = pilot;

  IF plane.owner_id = pilot THEN
    RETURN QUERY SELECT 'own_aircraft', true, NULL::text, NULL::text;
  END IF;
  IF prof.suspended_at IS NOT NULL THEN
    RETURN QUERY SELECT 'suspended', true, NULL::text, NULL::text;
  END IF;

  -- Licence: verified and valid; one of the accepted types if the owner chose some.
  IF NOT EXISTS (
    SELECT 1 FROM public.pilot_licences l
    WHERE l.user_id = pilot AND l.status = 'verified'
      AND (l.expires_on IS NULL OR l.expires_on >= on_day)) THEN
    RETURN QUERY SELECT 'licence', true, NULL::text, NULL::text;
  ELSIF has_req AND cardinality(req.licence_types) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.pilot_licences l
    WHERE l.user_id = pilot AND l.status = 'verified'
      AND (l.expires_on IS NULL OR l.expires_on >= on_day)
      AND l.type = ANY (req.licence_types)) THEN
    RETURN QUERY SELECT 'licence_type', true, array_to_string(req.licence_types, ','), NULL::text;
  END IF;

  -- Medical: verified and valid until the end of the rental.
  IF NOT EXISTS (
    SELECT 1 FROM public.medicals m
    WHERE m.user_id = pilot AND m.status = 'verified' AND m.valid_until >= on_day) THEN
    RETURN QUERY SELECT 'medical', true, NULL::text, NULL::text;
  END IF;

  -- Class rating for the category: aeroplanes need SEP or MEP (land), TMGs a TMG or SEP (land)
  -- rating. Ultralights (national licences) and helicopters (type ratings) are left to the
  -- owner's required ratings.
  IF plane.category IN ('aeroplane', 'tmg') AND NOT EXISTS (
    SELECT 1 FROM public.pilot_ratings pr
    WHERE pr.user_id = pilot AND pr.status = 'verified'
      AND (pr.expires_on IS NULL OR pr.expires_on >= on_day)
      AND pr.code = ANY (CASE plane.category WHEN 'aeroplane' THEN ARRAY['SEP_LAND', 'MEP_LAND']
                              ELSE ARRAY['TMG', 'SEP_LAND'] END)) THEN
    RETURN QUERY SELECT 'class_rating', true,
      CASE plane.category WHEN 'aeroplane' THEN 'SEP_LAND' ELSE 'TMG' END, NULL::text;
  END IF;

  -- Ratings and privileges the owner requires (class, privilege or type rating codes).
  IF has_req THEN
    FOREACH wanted_code IN ARRAY req.required_ratings LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.pilot_ratings pr
        WHERE pr.user_id = pilot AND pr.status = 'verified'
          AND (pr.expires_on IS NULL OR pr.expires_on >= on_day) AND pr.code = wanted_code) THEN
        RETURN QUERY SELECT 'rating', true, wanted_code, NULL::text;
      END IF;
    END LOOP;
  END IF;

  -- Night (30 min after sunset to 30 min before sunrise) at any airfield of the flight: the
  -- aircraft must be approved for night VFR and the pilot needs a verified, valid Night rating.
  -- Before a booking exists the aircraft's base stands in for the flight's airfields.
  IF wanted IS NOT NULL THEN
    FOR field IN
      SELECT a.latitude, a.longitude FROM public.airports a
      WHERE a.ident = ANY (coalesce(airfields, ARRAY[plane.home_airport_ident]))
    LOOP
      IF public.period_needs_night(wanted, field.latitude, field.longitude) THEN
        is_night := true;
        EXIT;
      END IF;
    END LOOP;
    IF is_night THEN
      IF NOT plane.night_vfr THEN
        RETURN QUERY SELECT 'aircraft_no_night', true, NULL::text, NULL::text;
      ELSIF NOT EXISTS (
        SELECT 1 FROM public.pilot_ratings pr
        WHERE pr.user_id = pilot AND pr.status = 'verified'
          AND (pr.expires_on IS NULL OR pr.expires_on >= on_day) AND pr.code = 'NIGHT') THEN
        RETURN QUERY SELECT 'night_rating', true, NULL::text, NULL::text;
      ELSE
        RETURN QUERY SELECT 'night_flight', false, NULL::text, NULL::text;
      END IF;
    END IF;
  END IF;

  IF NOT has_req THEN
    RETURN;
  END IF;

  -- Experience (self-declared).
  IF req.min_total_hours > coalesce(xp.total_hours, 0) THEN
    RETURN QUERY SELECT 'total_hours', true, req.min_total_hours::text,
      coalesce(xp.total_hours, 0)::text;
  END IF;
  IF req.min_type_hours IS NOT NULL THEN
    SELECT e.hours INTO type_hours FROM public.experience_by_type e
    WHERE e.user_id = pilot AND e.aircraft_type = plane.type_designator;
    IF req.min_type_hours > coalesce(type_hours, 0) THEN
      RETURN QUERY SELECT 'type_hours', true, req.min_type_hours::text,
        coalesce(type_hours, 0)::text;
    END IF;
  END IF;
  IF req.min_90_days_hours > coalesce(xp.last_90_days_hours, 0) THEN
    RETURN QUERY SELECT 'recent_hours', true, req.min_90_days_hours::text,
      coalesce(xp.last_90_days_hours, 0)::text;
  END IF;

  -- Age on the day of the rental.
  IF req.min_age IS NOT NULL THEN
    IF xp.birth_date IS NULL THEN
      RETURN QUERY SELECT 'age_unknown', true, req.min_age::text, NULL::text;
    ELSE
      years := extract(year FROM age(on_day, xp.birth_date))::int;
      IF years < req.min_age THEN
        RETURN QUERY SELECT 'age', true, req.min_age::text, years::text;
      END IF;
    END IF;
  END IF;

  -- Checkout flight with an instructor (BKG-10): for every pilot new to the aircraft, or (RAT-7)
  -- for pilots without reviews; not needed once the owner has recorded one.
  IF (req.checkout_first_rental
      OR (coalesce(prof.rating_count, 0) = 0 AND req.allow_unrated AND req.unrated_needs_checkout))
     AND NOT EXISTS (SELECT 1 FROM public.aircraft_checkouts c
                     WHERE c.aircraft_id = target AND c.pilot_id = pilot) THEN
    RETURN QUERY SELECT 'checkout', false, NULL::text, NULL::text;
  END IF;

  -- Pilot rating from earlier rentals (RAT-7 for pilots without reviews).
  IF coalesce(prof.rating_count, 0) = 0 THEN
    IF NOT req.allow_unrated THEN
      RETURN QUERY SELECT 'unrated', true, NULL::text, NULL::text;
    END IF;
  ELSIF req.min_pilot_rating > prof.rating_avg THEN
    RETURN QUERY SELECT 'pilot_rating', true, req.min_pilot_rating::text, prof.rating_avg::text;
  END IF;
END;
$$;
