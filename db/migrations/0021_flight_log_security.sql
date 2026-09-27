-- M6 flight log (BKG-7, BKG-12; plan §4.8). The pilot and owner of the booking see the log. The
-- pilot fills it in while it's a draft (or after the owner asked for a correction); status
-- changes go through the functions below and are recorded in booking_events.

CREATE TRIGGER flight_logs_set_updated_at BEFORE UPDATE ON public.flight_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint

-- Who is who for a log: its booking's pilot and owner.
CREATE OR REPLACE FUNCTION public.flight_log_role(log_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN b.pilot_id = app.current_user_id() THEN 'pilot'
    WHEN b.owner_id = app.current_user_id() THEN 'owner'
    WHEN public.user_has_role('admin') THEN 'admin'
  END
  FROM public.flight_logs l JOIN public.bookings b ON b.id = l.booking_id
  WHERE l.id = log_id
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.flight_log_role(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.flight_log_role(uuid) TO app_user;
--> statement-breakpoint

-- Whether the pilot may still change the log.
CREATE OR REPLACE FUNCTION public.flight_log_editable(log_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.flight_log_role(log_id) = 'pilot' AND EXISTS (
    SELECT 1 FROM public.flight_logs l
    WHERE l.id = log_id AND l.status IN ('draft', 'correction_requested'))
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.flight_log_editable(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.flight_log_editable(uuid) TO app_user;
--> statement-breakpoint

GRANT SELECT ON public.flight_logs TO app_user;
--> statement-breakpoint
GRANT UPDATE (hobbs_start, tach_start, fuel_start_l, oil_start_l, checkout_photo_id)
  ON public.flight_logs TO app_user;
--> statement-breakpoint
CREATE POLICY flight_logs_select ON public.flight_logs FOR SELECT TO app_user
  USING (public.flight_log_role(id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY flight_logs_update ON public.flight_logs FOR UPDATE TO app_user
  USING (public.flight_log_editable(id))
  WITH CHECK (checkout_photo_id IS NULL OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = checkout_photo_id AND d.owner_id = app.current_user_id()));
--> statement-breakpoint

GRANT SELECT, INSERT, DELETE ON public.flight_legs TO app_user;
--> statement-breakpoint
GRANT UPDATE (seq, from_ident, to_ident, block_off, engine_start, takeoff_at, landing_at,
  engine_stop, block_on, landings, hobbs_start, hobbs_end, tach_start, tach_end, fuel_before_l,
  fuel_after_l, oil_before_l, oil_after_l) ON public.flight_legs TO app_user;
--> statement-breakpoint
CREATE POLICY flight_legs_select ON public.flight_legs FOR SELECT TO app_user
  USING (public.flight_log_role(flight_log_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY flight_legs_insert ON public.flight_legs FOR INSERT TO app_user
  WITH CHECK (public.flight_log_editable(flight_log_id));
--> statement-breakpoint
CREATE POLICY flight_legs_update ON public.flight_legs FOR UPDATE TO app_user
  USING (public.flight_log_editable(flight_log_id))
  WITH CHECK (public.flight_log_editable(flight_log_id));
--> statement-breakpoint
CREATE POLICY flight_legs_delete ON public.flight_legs FOR DELETE TO app_user
  USING (public.flight_log_editable(flight_log_id));
--> statement-breakpoint

-- Check-out: the pilot starts the rental (from 2 hours before the booked time). Creates the
-- draft log and puts the booking in progress. Returns the log id (the existing one if any).
CREATE OR REPLACE FUNCTION public.start_flight_log(target uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  b public.bookings%ROWTYPE;
  log_id uuid;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = target FOR UPDATE;
  IF NOT FOUND OR b.pilot_id IS DISTINCT FROM me THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  SELECT id INTO log_id FROM public.flight_logs WHERE booking_id = target;
  IF log_id IS NOT NULL THEN
    RETURN log_id;
  END IF;
  IF b.status <> 'accepted' THEN
    RAISE EXCEPTION 'not_accepted' USING DETAIL = b.status::text;
  END IF;
  IF now() < lower(b.period) - interval '2 hours' THEN
    RAISE EXCEPTION 'too_early';
  END IF;
  INSERT INTO public.flight_logs (booking_id) VALUES (target) RETURNING id INTO log_id;
  UPDATE public.bookings SET status = 'in_progress' WHERE id = target;
  INSERT INTO public.booking_events (booking_id, actor_id, type) VALUES (target, me, 'checked_out');
  RETURN log_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.start_flight_log(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.start_flight_log(uuid) TO app_user;
--> statement-breakpoint

-- Check-in: the pilot submits the log for the owner to confirm.
CREATE OR REPLACE FUNCTION public.submit_flight_log(log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l public.flight_logs%ROWTYPE;
BEGIN
  IF NOT public.flight_log_editable(log_id) THEN
    RAISE EXCEPTION 'not_editable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.flight_legs WHERE flight_log_id = log_id) THEN
    RAISE EXCEPTION 'no_legs';
  END IF;
  UPDATE public.flight_logs SET status = 'submitted', submitted_at = now(), correction_note = NULL
  WHERE id = log_id RETURNING * INTO l;
  INSERT INTO public.booking_events (booking_id, actor_id, type)
  VALUES (l.booking_id, app.current_user_id(), 'log_submitted');
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.submit_flight_log(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.submit_flight_log(uuid) TO app_user;
--> statement-breakpoint

-- The owner asks the pilot to correct the submitted log.
CREATE OR REPLACE FUNCTION public.request_log_correction(log_id uuid, note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l public.flight_logs%ROWTYPE;
BEGIN
  IF public.flight_log_role(log_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF char_length(btrim(coalesce(note, ''))) = 0 THEN
    RAISE EXCEPTION 'note_required';
  END IF;
  UPDATE public.flight_logs SET status = 'correction_requested', correction_note = left(btrim(note), 500)
  WHERE id = log_id AND status = 'submitted' RETURNING * INTO l;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_submitted';
  END IF;
  INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
  VALUES (l.booking_id, app.current_user_id(), 'log_correction', jsonb_build_object('note', note));
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.request_log_correction(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.request_log_correction(uuid, text) TO app_user;
--> statement-breakpoint

-- The owner confirms the log: final flown time and amount due (worked out by the app's one
-- tested function, shown to both sides first). The booking is completed and the rest of its
-- calendar time is freed.
CREATE OR REPLACE FUNCTION public.confirm_flight_log(
  log_id uuid, flown_minutes integer, amount_due numeric, fuel_adjustment numeric DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l public.flight_logs%ROWTYPE;
BEGIN
  IF public.flight_log_role(log_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF flown_minutes < 0 OR amount_due < 0 THEN
    RAISE EXCEPTION 'bad_amount';
  END IF;
  UPDATE public.flight_logs
  SET status = 'confirmed', confirmed_at = now(), flown_minutes = confirm_flight_log.flown_minutes,
      amount_due = confirm_flight_log.amount_due,
      fuel_adjustment = confirm_flight_log.fuel_adjustment
  WHERE id = log_id AND status = 'submitted' RETURNING * INTO l;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_submitted';
  END IF;
  UPDATE public.bookings SET status = 'completed' WHERE id = l.booking_id;
  -- Returned early? The rest of the booked time is free again.
  UPDATE public.calendar_entries c
  SET period = tstzrange(lower(c.period), greatest(lower(c.period) + interval '1 minute',
                         least(upper(c.period), now())), '[)')
  WHERE c.booking_id = l.booking_id AND c.active;
  INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
  VALUES (l.booking_id, app.current_user_id(), 'log_confirmed',
    jsonb_build_object('flown_minutes', flown_minutes, 'amount_due', amount_due));
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.confirm_flight_log(uuid, integer, numeric, numeric) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.confirm_flight_log(uuid, integer, numeric, numeric) TO app_user;
