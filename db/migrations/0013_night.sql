-- Night flights (BKG-1 / RAT-6): part of a rental between 30 minutes after sunset and 30 minutes
-- before sunrise at the home base needs a night-VFR aircraft and a pilot with a Night rating.
-- Sunrise/sunset from the standard sunrise equation (NOAA simplification, about ±1 min), in plain
-- SQL so search and eligibility can use it without extensions.

-- Sunrise and sunset (UTC) on a UTC date at a place. Null sunrise+sunset with polar_night true:
-- the sun doesn't rise; both null with polar_night false: it doesn't set.
CREATE OR REPLACE FUNCTION public.sun_times(
  on_date date, lat double precision, lon double precision,
  OUT sunrise timestamptz, OUT sunset timestamptz, OUT polar_night boolean)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  n double precision := (on_date - date '2000-01-01') + 0.0008;
  j_star double precision := n - lon / 360.0;
  m double precision := mod((357.5291 + 0.98560028 * j_star)::numeric, 360)::double precision;
  c double precision;
  ecl double precision;
  transit double precision;
  decl double precision;
  cos_w double precision;
  w double precision;
BEGIN
  c := 1.9148 * sind(m) + 0.0200 * sind(2 * m) + 0.0003 * sind(3 * m);
  ecl := mod((m + c + 180 + 102.9372)::numeric, 360)::double precision;
  transit := 2451545.0 + j_star + 0.0053 * sind(m) - 0.0069 * sind(2 * ecl);
  decl := asind(sind(ecl) * sind(23.4397));
  cos_w := (sind(-0.833) - sind(lat) * sind(decl)) / (cosd(lat) * cosd(decl));
  IF cos_w > 1 THEN
    polar_night := true;
    RETURN;
  ELSIF cos_w < -1 THEN
    polar_night := false;
    RETURN;
  END IF;
  w := acosd(cos_w);
  polar_night := false;
  sunrise := to_timestamp((transit - w / 360.0 - 2440587.5) * 86400);
  sunset := to_timestamp((transit + w / 360.0 - 2440587.5) * 86400);
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.sun_times(date, double precision, double precision) TO app_user;
--> statement-breakpoint

-- Whether any part of the period is "night": from 30 min after sunset to 30 min before the next
-- sunrise (checked for every day the period touches, plus the evening before).
CREATE OR REPLACE FUNCTION public.period_needs_night(
  wanted tstzrange, lat double precision, lon double precision)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  d date := (lower(wanted) AT TIME ZONE 'utc')::date - 1;
  last_day date := (upper(wanted) AT TIME ZONE 'utc')::date;
  today record;
  tomorrow record;
  night_start timestamptz;
  night_end timestamptz;
BEGIN
  IF wanted IS NULL OR isempty(wanted) THEN
    RETURN false;
  END IF;
  WHILE d <= last_day LOOP
    today := public.sun_times(d, lat, lon);
    tomorrow := public.sun_times(d + 1, lat, lon);
    IF today.polar_night THEN
      -- No daylight at all: the whole day is night.
      IF wanted && tstzrange(d::timestamp AT TIME ZONE 'utc', (d + 1)::timestamp AT TIME ZONE 'utc')
      THEN
        RETURN true;
      END IF;
    ELSIF today.sunset IS NOT NULL THEN
      night_start := today.sunset + interval '30 minutes';
      night_end := coalesce(tomorrow.sunrise - interval '30 minutes',
        CASE WHEN tomorrow.polar_night THEN (d + 2)::timestamp AT TIME ZONE 'utc'
             ELSE night_start END);
      IF night_end > night_start AND wanted && tstzrange(night_start, night_end) THEN
        RETURN true;
      END IF;
    END IF;
    d := d + 1;
  END LOOP;
  RETURN false;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.period_needs_night(tstzrange, double precision, double precision)
  TO app_user;
--> statement-breakpoint

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
  home public.airports%ROWTYPE;
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

  -- Night (30 min after sunset to 30 min before sunrise at the home base): the aircraft must be
  -- approved for night VFR and the pilot needs a verified, valid Night rating.
  IF wanted IS NOT NULL THEN
    SELECT * INTO home FROM public.airports WHERE ident = plane.home_airport_ident;
    IF FOUND AND public.period_needs_night(wanted, home.latitude, home.longitude) THEN
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
