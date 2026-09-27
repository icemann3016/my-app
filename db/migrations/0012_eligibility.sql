-- M5: one eligibility check for search, the aircraft page and booking requests (plan §4.2,
-- RAT-6/7/8, VER-6). It reads private pilot data (medical, experience), so the core function is
-- not callable by users; the wrappers below only answer for the pilot themself (with reasons)
-- or give the aircraft's owner a yes/no.
GRANT UPDATE (birth_date) ON public.pilot_experience TO app_user;
--> statement-breakpoint

-- Failed requirements of a pilot for an aircraft. Credentials must be valid on the last day of
-- the wanted period (today if none). `blocking` = the pilot can't ask; non-blocking rows are
-- conditions (a checkout flight first). `need` / `have` carry the numbers for the message,
-- e.g. type_hours need 50, have 12.
CREATE OR REPLACE FUNCTION public.eligibility_failures(pilot uuid, target uuid, wanted tstzrange)
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

  -- Pilot rating from earlier rentals (RAT-7 for pilots without reviews).
  IF coalesce(prof.rating_count, 0) = 0 THEN
    IF NOT req.allow_unrated THEN
      RETURN QUERY SELECT 'unrated', true, NULL::text, NULL::text;
    ELSIF req.unrated_needs_checkout THEN
      RETURN QUERY SELECT 'checkout', false, NULL::text, NULL::text;
    END IF;
  ELSIF req.min_pilot_rating > prof.rating_avg THEN
    RETURN QUERY SELECT 'pilot_rating', true, req.min_pilot_rating::text, prof.rating_avg::text;
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.eligibility_failures(uuid, uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint

-- The logged-in pilot's own result, with reasons (aircraft page, booking form).
CREATE OR REPLACE FUNCTION public.my_eligibility(target uuid, wanted tstzrange DEFAULT NULL)
RETURNS TABLE (requirement text, blocking boolean, need text, have text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.requirement, f.blocking, f.need, f.have
  FROM public.eligibility_failures(app.current_user_id(), target, wanted) f
  WHERE app.current_user_id() IS NOT NULL AND public.aircraft_visible(target)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.my_eligibility(uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.my_eligibility(uuid, tstzrange) TO app_user;
--> statement-breakpoint

-- Whether the logged-in pilot may ask for this aircraft (search filter "I meet the requirements").
CREATE OR REPLACE FUNCTION public.i_meet_requirements(target uuid, wanted tstzrange DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.current_user_id() IS NOT NULL AND public.aircraft_visible(target) AND NOT EXISTS (
    SELECT 1 FROM public.eligibility_failures(app.current_user_id(), target, wanted) f
    WHERE f.blocking)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.i_meet_requirements(uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.i_meet_requirements(uuid, tstzrange) TO app_user;
--> statement-breakpoint

-- For the aircraft's owner (and admins): only yes/no, never which credential is missing, so
-- medical data stays private (VER-3). Null for anyone else.
CREATE OR REPLACE FUNCTION public.pilot_meets_requirements(
  pilot uuid, target uuid, wanted tstzrange DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.aircraft a
    WHERE a.id = target AND (a.owner_id = app.current_user_id() OR public.user_has_role('admin')))
  THEN NOT EXISTS (
    SELECT 1 FROM public.eligibility_failures(pilot, target, wanted) f WHERE f.blocking)
  END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.pilot_meets_requirements(uuid, uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.pilot_meets_requirements(uuid, uuid, tstzrange) TO app_user;
