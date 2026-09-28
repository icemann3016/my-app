-- M7 reviews (RAT-1…4; plan §4.3). After a completed booking the pilot reviews the aircraft and
-- its owner, and the owner reviews the pilot, once each, within 14 days of the owner confirming
-- the flight log. Double-blind: a review is visible only to its author until both have reviewed
-- (published at once) or the window has closed (published by the daily job). Averages on
-- profiles and aircraft follow published, not hidden reviews.

CREATE POLICY reviews_select ON public.reviews FOR SELECT TO app_user
  USING (author_id = app.current_user_id()
    OR (published_at IS NOT NULL AND hidden_at IS NULL)
    OR public.user_has_role('admin'));
--> statement-breakpoint
GRANT SELECT ON public.reviews TO app_user;
--> statement-breakpoint

-- Category keys per direction (RAT-2). The overall score is their average.
CREATE OR REPLACE FUNCTION public.review_categories(dir public.review_direction)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE dir
    WHEN 'pilot_to_owner' THEN ARRAY['aircraft_condition', 'communication', 'value']
    ELSE ARRAY['airmanship', 'punctuality', 'communication', 'condition_returned'] END
$$;
--> statement-breakpoint

-- When a completed booking's review window closes: 14 days after the owner confirmed the log.
CREATE OR REPLACE FUNCTION public.review_window_closes(target uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(l.confirmed_at, upper(b.period)) + interval '14 days'
  FROM public.bookings b LEFT JOIN public.flight_logs l ON l.booking_id = b.id
  WHERE b.id = target AND b.status = 'completed'
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.review_window_closes(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.review_window_closes(uuid) TO app_user;
--> statement-breakpoint

-- Publish the unpublished reviews of a booking; tells both sides once. Internal.
CREATE OR REPLACE FUNCTION public.publish_booking_reviews(target uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.reviews SET published_at = now()
  WHERE booking_id = target AND published_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
    VALUES (target, NULL, 'reviews_published', jsonb_build_object('count', n));
  END IF;
  RETURN n;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.publish_booking_reviews(uuid) FROM PUBLIC;
--> statement-breakpoint

-- Review a completed booking (RAT-1, RAT-4). scores: one integer 1–5 per category of the
-- direction, nothing else. Returns the review id.
-- Errors: not_found, window_closed, already_reviewed, bad_scores.
CREATE OR REPLACE FUNCTION public.submit_review(target uuid, scores jsonb, comment text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  b public.bookings%ROWTYPE;
  dir public.review_direction;
  cats text[];
  total numeric := 0;
  cat text;
  v jsonb;
  review_id uuid;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = target AND status = 'completed';
  IF me IS NULL OR NOT FOUND OR b.pilot_id IS NULL OR me NOT IN (b.pilot_id, b.owner_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF now() >= public.review_window_closes(target) THEN
    RAISE EXCEPTION 'window_closed';
  END IF;
  dir := CASE WHEN me = b.pilot_id THEN 'pilot_to_owner' ELSE 'owner_to_pilot' END;
  IF EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = target AND r.direction = dir) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;
  cats := public.review_categories(dir);
  IF scores IS NULL OR jsonb_typeof(scores) <> 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(scores)) <> cardinality(cats) THEN
    RAISE EXCEPTION 'bad_scores';
  END IF;
  FOREACH cat IN ARRAY cats LOOP
    v := scores -> cat;
    IF v IS NULL OR jsonb_typeof(v) <> 'number' OR (v #>> '{}')::numeric NOT IN (1, 2, 3, 4, 5) THEN
      RAISE EXCEPTION 'bad_scores';
    END IF;
    total := total + (v #>> '{}')::numeric;
  END LOOP;
  INSERT INTO public.reviews (booking_id, direction, author_id, subject_user_id,
                              subject_aircraft_id, scores, overall, comment)
  VALUES (target, dir, me,
          CASE WHEN dir = 'pilot_to_owner' THEN b.owner_id ELSE b.pilot_id END,
          CASE WHEN dir = 'pilot_to_owner' THEN b.aircraft_id END,
          scores, round(total / cardinality(cats), 2),
          nullif(left(btrim(coalesce(comment, '')), 2000), ''))
  RETURNING id INTO review_id;
  INSERT INTO public.booking_events (booking_id, actor_id, type)
  VALUES (target, me, 'review_submitted');
  -- Both sides have reviewed: reveal both now (RAT-3).
  IF (SELECT count(*) FROM public.reviews r WHERE r.booking_id = target) = 2 THEN
    PERFORM public.publish_booking_reviews(target);
  END IF;
  RETURN review_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.submit_review(uuid, jsonb, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, jsonb, text) TO app_user;
--> statement-breakpoint

-- Daily job (owner connection): publish reviews whose 14-day window has closed. Returns how many.
CREATE OR REPLACE FUNCTION public.publish_due_reviews()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer := 0;
  target uuid;
BEGIN
  FOR target IN
    SELECT DISTINCT r.booking_id FROM public.reviews r
    WHERE r.published_at IS NULL AND public.review_window_closes(r.booking_id) <= now()
  LOOP
    n := n + public.publish_booking_reviews(target);
  END LOOP;
  RETURN n;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.publish_due_reviews() FROM PUBLIC;
--> statement-breakpoint

-- Averages: a user's rating as a pilot and as an owner, and an aircraft's rating, from published
-- reviews that aren't hidden (RAT-2, RAT-6 uses the pilot rating).
CREATE OR REPLACE FUNCTION public.refresh_review_ratings(person uuid, plane uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF person IS NOT NULL THEN
    UPDATE public.profiles p SET
      rating_avg = s.pilot_avg, rating_count = s.pilot_n,
      owner_rating_avg = s.owner_avg, owner_rating_count = s.owner_n
    FROM (
      SELECT round(avg(overall) FILTER (WHERE direction = 'owner_to_pilot'), 2) AS pilot_avg,
             count(*) FILTER (WHERE direction = 'owner_to_pilot')::integer AS pilot_n,
             round(avg(overall) FILTER (WHERE direction = 'pilot_to_owner'), 2) AS owner_avg,
             count(*) FILTER (WHERE direction = 'pilot_to_owner')::integer AS owner_n
      FROM public.reviews
      WHERE subject_user_id = person AND published_at IS NOT NULL AND hidden_at IS NULL
    ) s
    WHERE p.id = person;
  END IF;
  IF plane IS NOT NULL THEN
    UPDATE public.aircraft a SET rating_avg = s.avg_, rating_count = s.n
    FROM (
      SELECT round(avg(overall), 2) AS avg_, count(*)::integer AS n
      FROM public.reviews
      WHERE subject_aircraft_id = plane AND published_at IS NOT NULL AND hidden_at IS NULL
    ) s
    WHERE a.id = plane;
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.refresh_review_ratings(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reviews_refresh_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.refresh_review_ratings(OLD.subject_user_id, OLD.subject_aircraft_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.refresh_review_ratings(NEW.subject_user_id, NEW.subject_aircraft_id);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reviews_refresh_ratings
  AFTER UPDATE OF published_at, hidden_at OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_refresh_ratings();
