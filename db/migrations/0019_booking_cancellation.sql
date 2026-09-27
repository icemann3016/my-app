-- M6: cancellations (BKG-6). Either side can cancel an open or accepted booking before it
-- starts, with a reason. Cancelling an accepted booking after the policy's free-cancellation
-- deadline is recorded as late (shown as a count on the public profile).

-- Hours before the start until which cancelling is free.
CREATE OR REPLACE FUNCTION public.cancellation_free_hours(policy public.cancellation_policy)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE policy WHEN 'flexible' THEN 24 WHEN 'moderate' THEN 72 ELSE 168 END
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cancellation_free_hours(public.cancellation_policy) TO app_user;
--> statement-breakpoint

-- New bookings keep the aircraft's policy at the time of the request.
CREATE OR REPLACE FUNCTION public.booking_copy_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  SELECT a.cancellation_policy INTO NEW.cancellation_policy
  FROM public.aircraft a WHERE a.id = NEW.aircraft_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bookings_copy_policy BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_copy_policy();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.cancel_booking(target uuid, reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  b public.bookings%ROWTYPE;
  late boolean;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = target FOR UPDATE;
  IF NOT FOUND OR me IS NULL OR (b.pilot_id IS DISTINCT FROM me AND b.owner_id <> me) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF b.status NOT IN ('requested', 'accepted') OR lower(b.period) <= now() THEN
    RAISE EXCEPTION 'not_cancellable' USING DETAIL = b.status::text;
  END IF;
  IF char_length(btrim(coalesce(reason, ''))) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  late := b.status = 'accepted'
    AND now() > lower(b.period) - make_interval(hours => public.cancellation_free_hours(b.cancellation_policy));

  UPDATE public.bookings
  SET status = 'cancelled', cancelled_by = me, cancelled_at = now(),
      cancel_reason = left(btrim(reason), 500), late_cancellation = late
  WHERE id = target;
  UPDATE public.calendar_entries SET active = false WHERE booking_id = target;
  INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
  VALUES (target, me, 'cancelled', jsonb_build_object('late', late));
  RETURN late;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text) TO app_user;
--> statement-breakpoint

-- Late cancellations a user made (as pilot or owner), for their public profile.
CREATE OR REPLACE FUNCTION public.late_cancellation_count(person uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::int FROM public.bookings b WHERE b.cancelled_by = person AND b.late_cancellation
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.late_cancellation_count(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.late_cancellation_count(uuid) TO app_user;
